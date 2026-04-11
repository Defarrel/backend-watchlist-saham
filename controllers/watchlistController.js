import db from "../config/db.js";
import axios from "axios";

// Menambahkan saham baru ke daftar pantauan user
export const addTicker = (req, res) => {
    const { ticker } = req.body;
    const userId = req.user.id; // Diambil dari token oleh middleware

    if (!ticker) return res.status(400).json({ message: "Ticker wajib diisi" });

    // Cek apakah saham sudah ada di watchlist user tersebut
    const checkQuery = "SELECT * FROM watchlists WHERE user_id = ? AND ticker = ?";
    db.query(checkQuery, [userId, ticker], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (result.length > 0) return res.status(400).json({ message: "Saham sudah ada di watchlist" });

        // Simpan ticker baru
        const insertQuery = "INSERT INTO watchlists (user_id, ticker) VALUES (?, ?)";
        db.query(insertQuery, [userId, ticker], (err2) => {
            if (err2) return res.status(500).json({ message: "Gagal menambahkan saham" });

            // ==========================================
            // [TAMBAHAN] CATAT KE ACTIVITY LOGS
            // ==========================================
            const logQuery = "INSERT INTO activity_logs (user_id, ticker, action, message) VALUES (?, ?, ?, ?)";
            const logMessage = `Menambahkan ${ticker} ke portofolio pantauan`;
            
            db.query(logQuery, [userId, ticker, 'add', logMessage], (errLog) => {
                if (errLog) console.error("Gagal mencatat log penambahan:", errLog);
                
                // Tetap kirim sukses ke React meskipun log gagal dicatat, agar UI tidak terganggu
                res.status(201).json({ message: "Saham berhasil ditambahkan" });
            });
        });
    });
};


// Menghapus saham dari daftar pantauan
export const deleteTicker = (req, res) => {
    const { ticker } = req.params;
    const userId = req.user.id;

    const sql = "DELETE FROM watchlists WHERE user_id = ? AND ticker = ?";
    db.query(sql, [userId, ticker], (err) => {
        if (err) return res.status(500).json({ message: "Gagal menghapus saham" });

        // ==========================================
        // [TAMBAHAN] CATAT KE ACTIVITY LOGS
        // ==========================================
        const logQuery = "INSERT INTO activity_logs (user_id, ticker, action, message) VALUES (?, ?, ?, ?)";
        const logMessage = `Menghapus ${ticker} dari daftar pantauan`;

        db.query(logQuery, [userId, ticker, 'delete', logMessage], (errLog) => {
            if (errLog) console.error("Gagal mencatat log penghapusan:", errLog);
            
            res.status(200).json({ message: "Saham berhasil dihapus" });
        });
    });
};

// Memindai saham yang ada di watchlist user
export const scanWatchlist = (req, res) => {
    const userId = req.user.id;
    const query = "SELECT ticker, target_price FROM watchlists WHERE user_id = ?";
    
    db.query(query, [userId], async (err, dbStocks) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (dbStocks.length === 0) return res.status(200).json({ data: [] });

        const tickers = dbStocks.map((row) => row.ticker);

        try {
            const mlResponse = await axios.post(`${process.env.ML_API_URL}/watchlist`, {
                tickers: tickers,
                period: "2y"
            });

            const combinedData = mlResponse.data.data.map((pythonData) => {
                const dbInfo = dbStocks.find(db => db.ticker === pythonData.ticker);
                
                // ========================================================
                // TAMBAHAN: SIMPAN KE PREDICTION_HISTORY
                // ========================================================
                const historyQuery = `
                    INSERT INTO prediction_history 
                    (user_id, ticker, close_price, prediction_label, prob_strong_up, anomaly_score, scanned_at) 
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                `;
                
                db.query(historyQuery, [
                    userId, 
                    pythonData.ticker, 
                    pythonData.close, 
                    pythonData.prediction, 
                    pythonData.p_strong_up || 0,
                    pythonData.anomaly_score || 0 // SEKARANG ANOMALY SCORE MASUK KE DB
                ], (errHist) => {
                    if (errHist) console.error("Gagal simpan history:", errHist.message);
                });
                // ========================================================

                return {
                    ...pythonData,
                    target_price: dbInfo ? dbInfo.target_price : 0
                };
            });

            res.status(200).json({ status: "success", data: combinedData });
            
        } catch (error) {
            console.error("Scan Error:", error.message);
            res.status(500).json({ message: "Gagal memindai saham" });
        }
    });
};

export const getWatchlist = (req, res) => {
    const userId = req.user.id;
    const sql = "SELECT id, ticker, created_at FROM watchlists WHERE user_id = ?";
    db.query(sql, [userId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.status(200).json(result);
    });
};

export const getHistory = (req, res) => {
    const userId = req.user.id;
    const sql = "SELECT * FROM prediction_history WHERE user_id = ? ORDER BY scanned_at DESC LIMIT 20";
    db.query(sql, [userId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.status(200).json(result);
    });
};

export const getIHSG = async (req, res) => {
    try {
        const response = await axios.get(`${process.env.ML_API_URL}/ihsg`);
        res.status(200).json(response.data);
    } catch (error) {
        console.error("IHSG Error:", error.message);
        res.status(500).json({ message: "Gagal mengambil data IHSG" });
    }
};

export const getMarketScreener = async (req, res) => {
    const defaultTickers = [
"AADI.JK","AALI.JK","AAPC.JK","ABBA.JK","ABDA.JK","ABMM.JK","ACES.JK","ACRO.JK","ACST.JK","ADCP.JK",
"ADES.JK","ADHI.JK","ADMF.JK","ADMG.JK","ADMR.JK","ADRO.JK","AGAR.JK","AGII.JK","AGIK.JK","AGRS.JK",
"AHAP.JK","AIMS.JK","AISA.JK","AKRA.JK","AKKU.JK","AKPI.JK","AKSI.JK","ALDO.JK","ALGM.JK","ALIC.JK",
"ALKA.JK","ALMI.JK","ALNC.JK","ALTO.JK","AMAG.JK","AMAN.JK","AMAR.JK","AMFG.JK","AMIN.JK","AMMN.JK",
"AMMS.JK","AMOR.JK","AMRT.JK","ANDI.JK","ANJT.JK","ANTM.JK","APEX.JK","APIC.JK","APII.JK","APLI.JK",
"APLN.JK","ARCI.JK","AREA.JK","ARGO.JK","ARII.JK","ARKA.JK","ARKO.JK","ARNA.JK","ARTA.JK","ARTI.JK",
"ARTO.JK","ASAP.JK","ASDM.JK","ASGR.JK","ASII.JK","ASJT.JK","ASLC.JK","ASMI.JK","ASMP.JK","ASPI.JK",
"ASRI.JK","ASRA.JK","ASRM.JK","ASSA.JK","ATAP.JK","ATIC.JK","AUTO.JK","AVIA.JK","AWAN.JK","AYLS.JK",
"AYZA.JK","BABP.JK","BACA.JK","BAIK.JK","BAJA.JK","BALI.JK","BANK.JK","BAPA.JK","BAPI.JK","BATA.JK",
"BATR.JK","BAUT.JK","BAYU.JK","BBCA.JK","BBHI.JK","BBKP.JK","BBLD.JK","BBMD.JK","BBNI.JK","BBRI.JK",
"BBRM.JK","BBSI.JK","BBTN.JK","BBYB.JK","BCAP.JK","BCIC.JK","BCIP.JK","BDKR.JK","BDMN.JK","BEBS.JK",
"BEEF.JK","BELL.JK","BENA.JK","BESS.JK","BEST.JK","BFIN.JK","BGTG.JK","BHAT.JK","BHIT.JK","BIKA.JK",
"BINA.JK","BINO.JK","BIPI.JK","BIPP.JK","BIRD.JK","BISI.JK","BJBR.JK","BJTM.JK","BKDP.JK","BKSL.JK",
"BKSW.JK","BLTA.JK","BLTZ.JK","BLUE.JK","BMAS.JK","BMBL.JK","BMHS.JK","BMRI.JK","BMSR.JK","BMTR.JK",
"BNBA.JK","BNBR.JK","BNGA.JK","BNII.JK","BNLI.JK","BOGA.JK","BOHT.JK","BOLA.JK","BOLT.JK","BOSS.JK",
"BPFI.JK","BPIIN.JK","BPII.JK","BRAM.JK","BRIS.JK","BRMS.JK","BRNA.JK","BRPT.JK","BSDE.JK","BSIM.JK",
"BSKL.JK","BSML.JK","BSSR.JK","BSWD.JK","BTG.JK","BTPS.JK","BTPN.JK","BUDI.JK","BUKA.JK","BUMI.JK",
"BUVA.JK","BVIC.JK","BWPT.JK","BYAN.JK","CAKK.JK","CAMP.JK","CANI.JK","CARE.JK","CASS.JK","CASH.JK",
"CBMF.JK","CCSI.JK","CEKA.JK","CENT.JK","CFIN.JK","CINT.JK","CITA.JK","CITY.JK","CLAY.JK","CLEO.JK",
"CLPI.JK","CMNP.JK","CMPP.JK","CMRY.JK","CNKO.JK","CNTX.JK","COAL.JK","COCO.JK","CODE.JK","COLL.JK",
"COWL.JK","CPIN.JK","CPRO.JK","CRAB.JK","CSAP.JK","CSIS.JK","CSMI.JK","CSRA.JK","CTBN.JK","CTRA.JK",
"CUAN.JK","CYBR.JK","DADA.JK","DART.JK","DATA.JK","DAYA.JK","DEAL.JK","DEFI.JK","DEGM.JK","DEPO.JK",
"DEWA.JK","DGIK.JK","DGNS.JK","DIGI.JK","DILD.JK","DIVA.JK","DKFT.JK","DLTA.JK","DMMX.JK","DMND.JK",
"DNAR.JK","DNET.JK","DOID.JK","DPNS.JK","DRMA.JK","DSFI.JK","DSNG.JK","DSSA.JK","DUCK.JK","DUTI.JK",
"DYAN.JK","EAST.JK","ECII.JK","EDEN.JK","EDGE.JK","EKAD.JK","ELIT.JK","ELKP.JK","ELPI.JK","ELSA.JK",
"ELTY.JK","EMTK.JK","ENAK.JK","ENRG.JK","ENSE.JK","ENVY.JK","EPMT.JK","ERAA.JK","ERTX.JK","ESSA.JK",
"ESTA.JK","ESTI.JK","ETWA.JK","EXCL.JK","FAST.JK","FAPA.JK","FASW.JK","FILM.JK","FIMP.JK","FIRE.JK",
"FISH.JK","FITT.JK","FLMC.JK","FMII.JK","FOOD.JK","FORU.JK","FPNI.JK","FUJI.JK","FWCT.JK","GAMA.JK",
"GAYA.JK","GBIO.JK","GDST.JK","GDYR.JK","GEMA.JK","GEMS.JK","GGRM.JK","GHP.JK","GHON.JK","GIAA.JK",
"GJTL.JK","GLOB.JK","GLVA.JK","GMTD.JK","GOLD.JK","GOOD.JK","GOTO.JK","GPRA.JK","GPSO.JK","GRPH.JK",
"GRPM.JK","GST.JK","GTBO.JK","GTRA.JK","GTSI.JK","GZCO.JK","HAIS.JK","HATM.JK","HADE.JK","HDIT.JK",
"HEAL.JK","HELI.JK","HERO.JK","HEXA.JK","HITS.JK","HKYE.JK","HMSP.JK","HOKI.JK","HOLZ.JK","HOME.JK",
"HOPE.JK","HRME.JK","HRTA.JK","HRUM.JK","HUMI.JK","HYYE.JK","IATA.JK","IBOS.JK","IBSN.JK","IBST.JK",
"ICBP.JK","ICON.JK","IDEA.JK","IDPR.JK","IFII.JK","IFSH.JK","IGAR.JK","IIKP.JK","IKAI.JK","IKAN.JK",
"IKBI.JK","IMAS.JK","IMJS.JK","IMPC.JK","INAF.JK","INAI.JK","INCF.JK","INCI.JK","INCO.JK","INDF.JK",
"INDO.JK","INDR.JK","INDS.JK","INDX.JK","INDY.JK","INET.JK","INKP.JK","INOV.JK","INPC.JK","INPP.JK",
"INPS.JK","INRA.JK","INRU.JK","INST.JK","INTA.JK","INTD.JK","INTP.JK","IPCC.JK","IPCM.JK","IPPE.JK",
"IPOL.JK","IPTV.JK","IRRA.JK","ISAP.JK","ISAT.JK","ISSP.JK","ITIC.JK","ITMA.JK","ITMG.JK","IZF.JK",
"JAWA.JK","JAYA.JK","JECC.JK","JEST.JK","JGLE.JK","JIHD.JK","JKON.JK","JMAS.JK","JPFA.JK","JRPT.JK",
"JSMR.JK","JSKY.JK","JTPE.JK","KAEF.JK","KARW.JK","KASW.JK","KAYU.JK","KBAG.JK","KBLI.JK","KBLM.JK",
"KBLV.JK","KBRI.JK","KDSI.JK","KEEN.JK","KEJU.JK","KIAS.JK","KICI.JK","KIJA.JK","KILS.JK","KINE.JK",
"KIOS.JK","KJEN.JK","KKGI.JK","KLAS.JK","KLBF.JK","KLIN.JK","KMDS.JK","KMTR.JK","KNTV.JK","KOIN.JK",
"KOKA.JK","KOPI.JK","KOTA.JK","KOX.JK","KPAL.JK","KPAS.JK","KPIG.JK","KRAH.JK","KRAS.JK","KRYA.JK",
"KSZZ.JK","KTOA.JK","KWA.JK","LABA.JK","LAND.JK","LAPD.JK","LCGP.JK","LCKM.JK","LEAD.JK","LFLO.JK",
"LIFE.JK","LINK.JK","LMAX.JK","LMSH.JK","LMAS.JK","LMPI.JK","LPKR.JK","LPLI.JK","LPPF.JK","LPPS.JK",
"LRNA.JK","LSIP.JK","LTLS.JK","LUCY.JK","LUCK.JK","MAGP.JK","MAIN.JK","MAMI.JK","MAPA.JK","MAPI.JK",
"MARI.JK","MARK.JK","MASB.JK","MAYA.JK","MBAP.JK","MBMA.JK","MBSS.JK","MBTO.JK","MCAS.JK","MCOL.JK",
"MDKA.JK","MDLN.JK","MDRN.JK","MEDC.JK","MEGA.JK","MERK.JK","META.JK","MFIN.JK","MFMI.JK","MGLV.JK",
"MGNA.JK","MGRO.JK","MICE.JK","MIDI.JK","MIKA.JK","MINA.JK","MIRA.JK","MITI.JK","MKNT.JK","MKPI.JK",
"MLBI.JK","MLIA.JK","MLPL.JK","MLPT.JK","MMLP.JK","MNCN.JK","MNDO.JK","MOLI.JK","MORA.JK","MPPA.JK",
"MPRO.JK","MPMX.JK","MSIN.JK","MSKY.JK","MTMH.JK","MTDL.JK","MTEL.JK","MTFN.JK","MTLA.JK","MTPS.JK",
"MTWI.JK","MYOH.JK","MYOR.JK","MYTX.JK","NAGA.JK","NASA.JK","NASI.JK","NATO.JK","NAYZ.JK","NCKL.JK",
"NELY.JK","NETV.JK","NFCX.JK","NICE.JK","NIKL.JK","NINE.JK","NIPS.JK","NIRO.JK","NOBU.JK","NPGF.JK",
"NRCA.JK","NSSS.JK","NTBK.JK","NUSA.JK","NZIA.JK","OASA.JK","OBMD.JK","OILM.JK","OKAS.JK","OKD.JK",
"OLIV.JK","OMRE.JK","OPMS.JK","PACK.JK","PADA.JK","PAMG.JK","PANI.JK","PANR.JK","PANS.JK","PBID.JK",
"PBRX.JK","PBSA.JK","PCAR.JK","PDES.JK","PDPP.JK","PEGE.JK","PEHA.JK","PGAS.JK","PGEO.JK","PGLI.JK",
"PGJO.JK","PGO.JK","PICO.JK","PIPE.JK","PIS.JK","PJAA.JK","PKPK.JK","PLAN.JK","PLIN.JK","PLNC.JK",
"PMJS.JK","PMMP.JK","PNBN.JK","PNBS.JK","PNLF.JK","PNGO.JK","PNIN.JK","PNSE.JK","POLA.JK","POLL.JK",
"POLI.JK","POLU.JK","POLY.JK","POOL.JK","PORT.JK","POSA.JK","POWR.JK","PPGL.JK","PPRE.JK","PPRO.JK",
"PRAS.JK","PRAY.JK","PRIM.JK","PSAB.JK","PSGO.JK","PSKT.JK","PSSI.JK","PTBA.JK","PTDU.JK","PTIS.JK",
"PTPP.JK","PTMP.JK","PTPW.JK","PTSN.JK","PUDP.JK","PURA.JK","PURR.JK","PUSR.JK","PWON.JK","PYFA.JK",
"RAAM.JK","RAJA.JK","RALS.JK","RANC.JK","RBMS.JK","RDTX.JK","REAL.JK","RELI.JK","REPI.JK","RICY.JK",
"RIGS.JK","RIIX.JK","RISE.JK","RMKE.JK","ROCK.JK","RODA.JK","ROHK.JK","RONY.JK","ROTI.JK","RSGK.JK",
"RUIS.JK","RUNS.JK","SAFE.JK","SAME.JK","SAMF.JK","SAPX.JK","SATU.JK","SBAT.JK","SBMA.JK","SCCO.JK",
"SCMA.JK","SCMN.JK","SCMP.JK","SCND.JK","SCO.JK","SDMU.JK","SDPC.JK","SDRA.JK","SEAT.JK","SEDA.JK",
"SFAN.JK","SGER.JK","SGRO.JK","SHID.JK","SHIP.JK","SICO.JK","SIDO.JK","SILO.JK","SIMP.JK","SINI.JK",
"SIPD.JK","SKBM.JK","SKLT.JK","SKRN.JK","SKYB.JK","SLIS.JK","SMAR.JK","SMBR.JK","SMCB.JK","SMDM.JK",
"SMDR.JK","SMGR.JK","SMIL.JK","SMKL.JK","SMKM.JK","SMMT.JK","SMOP.JK","SMPL.JK","SMRA.JK","SMRT.JK",
"SMSM.JK","SNLK.JK","SOCI.JK","SOFA.JK","SOHO.JK","SONA.JK","SOSA.JK","SOSS.JK","SOTS.JK","SOUL.JK",
"SPMA.JK","SPT.JK","SPTO.JK","SQMI.JK","SRAJ.JK","SRIL.JK","SRSN.JK","SRTG.JK","SSIA.JK","SSMS.JK",
"SSTM.JK","STAR.JK","STAA.JK","STTP.JK","SUGB.JK","SUGI.JK","SULI.JK","SUN.JK","SUPR.JK","SURY.JK",
"SWAT.JK","TABG.JK","TACA.JK","TAMA.JK","TAMU.JK","TAPG.JK","TARA.JK","TAXI.JK","TBIG.JK","TBLA.JK",
"TBMS.JK","TCID.JK","TCPI.JK","TDPM.JK","TEBE.JK","TECH.JK","TELE.JK","TFAS.JK","TFCO.JK","TGKA.JK",
"TGRA.JK","TIFA.JK","TINS.JK","TIRA.JK","TIRT.JK","TKIM.JK","TLDN.JK","TLKM.JK","TMAS.JK","TMPO.JK",
"TNCA.JK","TOBA.JK","TOOL.JK","TOTL.JK","TOTO.JK","TOWR.JK","TPIA.JK","TPMA.JK","TRAM.JK","TRGU.JK",
"TRIM.JK","TRIN.JK","TRIS.JK","TRJA.JK","TRON.JK","TRST.JK","TRUK.JK","TSPC.JK","TUGU.JK","TURI.JK",
"TYRE.JK","UANG.JK","UCID.JK","UDNG.JK","UFOE.JK","ULTJ.JK","UNIC.JK","UNSP.JK","UNTR.JK","UNVR.JK",
"URBN.JK","UVCR.JK","VICI.JK","VIC.JK","VINS.JK","VIVA.JK","VKTR.JK","VOKS.JK","VRNA.JK","VTNY.JK",
"WAPO.JK","WART.JK","WEGE.JK","WEHA.JK","WGSH.JK","WIFI.JK","WIGS.JK","WII.JK","WIIM.JK","WIKA.JK",
"WINS.JK","WIPO.JK","WOMF.JK","WOOD.JK","WOWS.JK","WSKT.JK","WTON.JK","WULA.JK","YELO.JK",
"YPAS.JK","YULE.JK","ZATA.JK","ZBRA.JK","ZYRX.JK"
    ];

    try {
        const mlResponse = await axios.post(`${process.env.ML_API_URL}/watchlist`, {
            tickers: defaultTickers,
            period: "2y"
        });

        res.status(200).json(mlResponse.data);
    } catch (error) {
        console.error("Screener Error:", error.message);
        res.status(500).json({ message: "Gagal memuat Market Screener" });
    }
};

export const getModelReports = async (req, res) => {
    try {
        const response = await axios.get(`${process.env.ML_API_URL}/reports`);
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil laporan model" });
    }
};

export const getActivityLogs = (req, res) => {
    const query = 'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
    
    db.query(query, [req.user.id], (err, logs) => {
        if (err) {
            console.error("Activity Log Error:", err.message);
            return res.status(500).json({ message: "Gagal memuat riwayat aktivitas" });
        }
        
        // Kirim data logs ke React
        res.status(200).json({ status: "success", data: logs });
    });
};

// [UPDATE] Mengubah Target Harga di Watchlist (Versi Callback)
export const updateWatchlist = (req, res) => {
    const { ticker } = req.params;
    const { target_price } = req.body;
    const userId = req.user.id; // Diambil dari token

    const updateQuery = 'UPDATE watchlists SET target_price = ? WHERE ticker = ? AND user_id = ?';

    db.query(updateQuery, [target_price, ticker, userId], (err, result) => {
        if (err) {
            console.error("Update Error:", err.message);
            return res.status(500).json({ message: "Gagal memperbarui data" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Saham tidak ditemukan di pantauan" });
        }

        // ==========================================
        // CATAT KE ACTIVITY LOGS
        // ==========================================
        const logQuery = 'INSERT INTO activity_logs (user_id, ticker, action, message) VALUES (?, ?, ?, ?)';
        const logMessage = `Mengubah target harga ${ticker} menjadi Rp ${target_price}`;

        db.query(logQuery, [userId, ticker, 'update', logMessage], (errLog) => {
            if (errLog) console.error("Gagal mencatat log update:", errLog);

            // Berhasil update dan log
            res.status(200).json({ status: "success", message: "Target harga diperbarui" });
        });
    });
};