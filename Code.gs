function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('🐱💰 招財貓・六合彩實時天時×歷史傾向生成器 v6.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 一鍵由 Google 伺服器同時抓取「香港天文台實時溫濕度」及「最新一期六合彩結果」
function getLiveAllDataFromServer() {
  var weather = { temp: 26.5, hum: 71, station: '香港天文台', ok: false };
  try {
    var wRes = UrlFetchApp.fetch('[https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc](https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc)', { muteHttpExceptions: true });
    var wData = JSON.parse(wRes.getContentText());
    if (wData.temperature && wData.temperature.data && wData.temperature.data.length > 0) {
      var hko = wData.temperature.data[0];
      for (var i = 0; i < wData.temperature.data.length; i++) {
        if (wData.temperature.data[i].place === '香港天文台') {
          hko = wData.temperature.data[i];
          break;
        }
      }
      weather.temp = Number(hko.value);
      weather.station = hko.place;
      weather.ok = true;
    }
    if (wData.humidity && wData.humidity.data && wData.humidity.data.length > 0) {
      weather.hum = Number(wData.humidity.data[0].value);
    }
  } catch (e) {}

  var latestDraw = fetchLatestMarkSixFromServer();
  return { weather: weather, latestDraw: latestDraw };
}

// 單獨抓取最新一期六合彩號碼（雙通道）
function fetchLatestMarkSixFromServer() {
  // 通道 1：馬會新版 GraphQL 接口
  try {
    var gqlUrl = '[https://info.cld.hkjc.com/graphql/base/](https://info.cld.hkjc.com/graphql/base/)';
    var payload = {
      operationName: "marksixResult",
      variables: {},
      query: "query marksixResult { lotteryDraws(lastNDraw: 5) { id year no drawDate drawResult { drawnNo xDrawnNo } } }"
    };
    var res = UrlFetchApp.fetch(gqlUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var json = JSON.parse(res.getContentText());
    var draws = json && json.data && json.data.lotteryDraws;
    if (Array.isArray(draws)) {
      for (var i = 0; i < draws.length; i++) {
        var d = draws[i];
        if (d.drawResult && Array.isArray(d.drawResult.drawnNo) && d.drawResult.drawnNo.length >= 6) {
          var nums = [];
          for (var j = 0; j < d.drawResult.drawnNo.length; j++) {
            nums.push(Number(d.drawResult.drawnNo[j]));
          }
          if (d.drawResult.xDrawnNo) nums.push(Number(d.drawResult.xDrawnNo));
          var yr = String(d.year || '').slice(-2);
          var no = ('000' + String(d.no || '')).slice(-3);
          var dDate = d.drawDate ? String(d.drawDate).slice(0, 10) : '';
          return { drawId: yr + '/' + no + '期', drawDate: dDate, numbers: nums };
        }
      }
    }
  } catch (e) {}

  // 通道 2：Lottolyzer 六合彩歷史庫備援
  try {
    var backupUrl = '[https://en.lottolyzer.com/history/hong-kong/mark-six](https://en.lottolyzer.com/history/hong-kong/mark-six)';
    var html = UrlFetchApp.fetch(backupUrl, { muteHttpExceptions: true }).getContentText();
    var regex = /<td[^>]*>\s*(\d{2}\/\d{3})\s*<\/td>\s*<td[^>]*>\s*([\d-]+)\s*<\/td>\s*<td[^>]*>\s*(\d+(?:\s*,\s*\d+){5})\s*<\/td>\s*<td[^>]*>\s*(\d{1,2})\s*<\/td>/i;
    var match = html.match(regex);
    if (match) {
      var parts = match[3].split(',');
      var mainNums = [];
      for (var k = 0; k < parts.length; k++) {
        mainNums.push(parseInt(parts[k].replace(/\s+/g, ''), 10));
      }
      mainNums.push(parseInt(match[4].replace(/\s+/g, ''), 10));
      return { drawId: match[1] + '期 (' + match[2] + ')', drawDate: match[2], numbers: mainNums };
    }
  } catch (e) {}

  return null;
}