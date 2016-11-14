var http = require('http');
var fs = require('fs');
var frage = 1;

function saveFile(path, data, binary) {
  if(binary) {
    fs.writeFile(path, data, 'binary', function(err) {
      if (err) {
        console.log(err);
      } else {}
    });
  } else {
    fs.writeFile(path, data, function(err) {
      if (err) {
        console.log(err);
      } else {}
    });
  }
};

function loadData(path, callback, binary) {
  http.get(path, function(res) {
    var data = '';

    if(binary) res.setEncoding('binary');

    res.on('data', function(chunk) {
      data += chunk;
    });

    res.on('end', function() {
      callback(data);
    });
  }).on('error', function(e) {
    console.log("Got error: " + e.message);
  });
};

function loadJson(path, callback) {
  loadData(path, function(data) {
    try {
      callback(JSON.parse(data));
    } catch(e) {
      callback();
    }
  });
};

function loadImage(path) {
  loadData("http://www.oeamtc.at/media/php_apps/fuehrerscheintest/bilder/gross/" + path, function(data) {
    saveFile("images/" + path, data, true);
  }, true);
};

function loadFrage() {
  loadJson("http://www.oeamtc.at/fuehrerschein/oeamtc/out/fragen/" + frage + ".json", function(response) {
    if(response) {
      saveFile("fragen/" + frage + ".json", JSON.stringify(response));
      if(response.BildName) loadImage(response.BildName);

      console.log("Saved Question " + frage);
    }
    frage++;
    loadFrage();
  });
};

loadJson("http://www.oeamtc.at/fuehrerschein/oeamtc/out/pruefungsmodelle.json", function(response) {
  saveFile("pruefungen.json", JSON.stringify(response));
  console.log("Saved Pruefungen");

  Object.keys(response).forEach(function(key) {
    loadJson("http://www.oeamtc.at/fuehrerschein/oeamtc/out/themen/" + key + ".json", function(response) {
      saveFile("themen/" + key + ".json", JSON.stringify(response));
      console.log("Saved Topic " + key);
    });
  });
});

loadFrage();