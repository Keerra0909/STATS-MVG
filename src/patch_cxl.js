window.runCXLPatch = async function() {
    const cxlData = {
      "2026-05": {
        "NANCY": 1, "ANA M": 4, "TONY": 1, "MONTSE": 1, "MIKE": 1, "PAOLO": 2, "GALA": 3, "ESTEBAN": 1
      },
      "2026-06": {
        "ISA": 1, "ANDRES G": 1, "JOSEFINA": 1, "ADRIAN": 1, "RICKY": 2, "MICHELLE": 1, "CHRIS": 4, "ANDRES A": 1
      }
    };
    
    if (!confirm('Patch CXL?')) return;
    
    try {
        let batchPromises = [];
        for (const [month, reps] of Object.entries(cxlData)) {
            // we will use the 2nd day of the month to store CXL so it doesn't conflict with day 1 maybe?
            // Actually any day works. Let's use YYYY-MM-28
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
