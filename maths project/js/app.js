'use strict';
/* ============ app initialization & event wiring ============ */
function populate() {
    fill('#sumVar', varOpts(), 'aqi'); fill('#histCity', cityOpts(), 'all'); fill('#outCity', cityOpts(false)); fill('#outVar', varOpts(), 'aqi');
    fill('#cmCity', cityOpts(), 'all'); fill('#tVar', varOpts(), 'aqi'); setTestRestrict();
    fill('#lagVar', availKeys().filter(k => k !== 'aqi' && !POLL.includes(k)).concat(['aqi']).map(k => [k, k === 'aqi' ? 'AQI (autocorrelation)' : lab(k)]), WX.find(hasVar) || 'aqi'); fill('#lagCity', cityOpts(), 'all');
}

function renderAll() {
    renderHero(); renderData(); renderSummary(); renderOutliers();
    renderCorr(); renderLab(); renderReal(); renderTests();
    renderLag(); renderSQL(); renderER(); renderFindings();
}

function setData(raw, name) {
    RAW = raw; srcName = name; dsCache = {};
    populate(); renderAll(); observeReveal();
}

['sumVar', 'sumBy'].forEach(i => $('#' + i).onchange = renderSummary);
$('#histCity').onchange = renderHist;
['outCity', 'outVar', 'outMethod'].forEach(i => $('#' + i).onchange = renderOutliers);
['cmCity', 'cmDes'].forEach(i => $('#' + i).onchange = renderCorr);
segBind('cmMode', renderCorr, 'm');
['labMode', 'labK', 'labM'].forEach(i => $('#' + i).oninput = renderLab);
['tVar', 'tRes'].forEach(i => $('#' + i).onchange = renderTests);
$('#tBy').onchange = () => { setTestRestrict(); renderTests() };
['lagVar', 'lagCity', 'lagDes'].forEach(i => $('#' + i).onchange = renderLag);
segBind('gapSeg', g => {
    gapMode = +g;
    renderHero(); renderData(); renderSummary(); renderOutliers();
    renderCorr(); renderReal(); renderTests(); renderLag(); renderFindings();
}, 'g');

$('#upBtn').onclick = () => $('#file').click();
$('#file').onchange = e => {
    const fl = e.target.files[0]; if (!fl) return;
    const rd = new FileReader();
    rd.onload = () => {
        try { setData(loadCSV(rd.result), 'Uploaded: ' + fl.name) }
        catch (err) { alert(err.message) }
    };
    rd.readAsText(fl);
};
$('#resetBtn').onclick = () => setData(genDemo(), 'Simulated demo data · 8 cities · 2018–2020 · seeded');

// Boot with seeded demo dataset
setData(genDemo(), 'Simulated demo data · 8 cities · 2018–2020 · seeded');
renderDSA();
observeReveal();