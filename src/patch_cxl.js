window.runCXLPatch = async function() {
    const cxlData = {
      "2026-01": { "ANDERSON": 11, "MIKE": 1, "PAOLO": 1, "JUANJO JJ": 8, "DUNIA": 1, "ISA": 2, "MICHELLE": 3, "HECTOR": 2, "ANA M": 4, "RENATA": 4, "PATTY": 1, "RICARDO": 1, "ERICK": 3 },
      "2026-02": { "BONJO": 2, "MICHELLE": 1, "SERGIO": 4, "SEBASTIAN": 1, "RENATA": 3, "JUANJO JJ": 1, "ESTEBAN": 1, "LUIS A": 1, "TONY": 8, "RICARDO": 2, "ANDERSON": 2 },
      "2026-03": { "MARIJO B": 1, "MIKE": 2, "ISA": 2, "JOSEFINA": 1, "HECTOR": 1, "SERGIO": 1, "ERICK": 2, "BONJO": 2, "GINA": 2, "ESTEBAN": 2, "RICKY": 1 },
      "2026-04": { "DUNIA": 2, "PATTY": 1, "BONJO": 1, "HECTOR": 1, "RICKY": 1, "NANCY": 1, "ISA": 2 },
      "2026-05": { "NANCY": 1, "ANA M": 4, "TONY": 1, "MONTSE": 1, "MIKE": 1, "PAOLO": 2, "GALA": 3, "ESTEBAN": 1 },
      "2026-06": { "ISA": 1, "ANDRES G": 1, "JOSEFINA": 1, "ADRIAN": 1, "RICKY": 2, "MICHELLE": 1, "CHRIS": 4, "ANDRES A": 1 }
    };
    
    if (!confirm('Patch CXL from Jan to June?')) return;
    
    try {
        let batchPromises = [];
        for (const [month, reps] of Object.entries(cxlData)) {
            const dateStr = month + '-28';
            for (const [rep, cxlCount] of Object.entries(reps)) {
                const docId = rep + '_' + dateStr;
                const p = firestore.collection('stats').doc(docId).set({
                    name: rep,
                    date: dateStr,
                    month: month,
                    cxl: cxlCount,
                    shots: 0,
                    ventas: 0,
                    ads: 0,
                    links: 0,
                    updatedAt: new Date()
                }, { merge: true });
                batchPromises.push(p);
            }
        }
        await Promise.all(batchPromises);
        alert('CXL Patched successfully!');
    } catch(e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}
