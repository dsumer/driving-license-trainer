var cjson = require('cjson');
var fs = require('fs');

function DrivingLicense(app) {
  var self = this;

  this.app = app;

  this.dataPath = 'public/data/';
  this.imgPath = 'data/images/';

  this.punkte = {
    1: /* leicht */
    [1, 1, 1],
    2: /* mittel */
    [3, 2, 1],
    3: /* schwer */
    [5, 3, 1]
  };

  this.state = 'index';

  this.currentPruefung = 'K';

  this.currentKartei = 0;
  this.currentTopics = [];

  this.currentFragen = [];
  this.currentAnswers = [];
  this.currentFrage = 0;
  this.currentZusatz = -1;
  this.answering = false;
  this.isRight = false;

  this.loadData();

  app.use(function(req, res) {
    res.status(400);
    res.redirect('/');
  });

  app.get('/', function(req, res) {
    switch (self.state) {
    case 'finish':
      self.state = 'index';
      res.redirect('/');
      break;
    case 'test':
      var answers;

      if (req.query.answer) {
        var isRight = true;

        answers = {
          0: {
            input: req.query[0]
          },
          1: {
            input: req.query[1]
          },
          2: {
            input: req.query[2]
          },
          3: {
            input: req.query[3]
          }
        };

        for (var i = 0; i < 4; i++) {
          answers[i] = {
            input: req.query[i] ? true : false
          };
          if (answers[i].input !== self.currentAnswers[i].richtig) isRight = false;
        }

        answers.isRight = isRight;
        self.isRight = isRight;
        self.answering = true;
      } else {
        if (self.answering) {
          if (self.isRight) {
            self.currentZusatz++;
            if (self.currentFragen[self.currentFrage].ZusatzFragen.length - 1 < self.currentZusatz) {
              self.pushFragenKartei(self.currentFragen[self.currentFrage].FRAGEID);
              self.currentZusatz = -1;
              self.currentFrage++;
            }
          } else {
            if (self.currentFrage > -1) self.resetFrageKartei(self.currentFragen[self.currentFrage].FRAGEID);
            self.currentZusatz = -1;
            self.currentFrage++;
          }
        }
      }

      if (self.currentFrage === self.currentFragen.length) {
        self.state = 'finish';
        res.redirect('/');
        return;
      }

      var frage = self.currentFragen[self.currentFrage];
      var whatFrage = 'Hauptfrage';

      if (self.currentZusatz > -1) {
        frage = frage.ZusatzFragen[self.currentZusatz];
        whatFrage = (self.currentZusatz + 1) + ". Zusatzfrage"
      }

      var realFrage = self.getFrage(frage.FRAGEID);

      if (req.query.answer === undefined && self.answering) {
        self.answering = false;
        self.createAnswers(realFrage);
      }

      var points;
      if (self.currentZusatz < 0) {
        points = self.punkte[realFrage.SCHWIERIGID][0];
      } else {
        points = self.punkte[realFrage.SCHWIERIGID][(self.currentZusatz + 1)];
      }

      res.render('frage', {
        FragenInfo: frage,
        Frage: realFrage,
        WhatFrage: whatFrage,
        Punkte: points,
        Kartei: self.getFrageKartei(self.currentFragen[self.currentFrage].FRAGEID),
        ThemaName: self.pruefungen[self.currentPruefung].ThemenExtended[realFrage.THEMAID].Bezeichnung,
        CurrentAnswers: self.currentAnswers,
        Answers: answers,
        Stats: {
          Current: self.currentFrage + 1,
          Max: self.currentFragen.length,
          Zusatz: self.currentZusatz + 1
        }
      });
      break;
    default:
      res.render('index', {
        Pruefungen: self.pruefungen
      });
      break;
    }
  });


  app.get('/choose', function(req, res) {
    if (self.state === 'index') {
      if (req.query.kartei) {
        if (Object.keys(req.query).length > 1) {
          self.currentKartei = parseInt(req.query.kartei);
          delete req.query.kartei;
          self.currentTopics.length = 0;
          for (var i in req.query) {
            self.currentTopics.push(i);
          }
          self.startTest();
        }
        res.redirect('/');
      } else {
        self.refreshKarteiCount();
        for (var j = 0; j < self.pruefungen[self.currentPruefung].Themen.length; j++) {
          self.pruefungen[self.currentPruefung].Themen[j].karteiCount = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0
          };
          for (var i = 0; i < self.topics[self.currentPruefung][self.pruefungen[self.currentPruefung].Themen[j].ID].Fragen.length; i++) {
            var frage = self.topics[self.currentPruefung][self.pruefungen[self.currentPruefung].Themen[j].ID].Fragen[i];
            if (!frage.IstZusatzFrage) {
              self.pruefungen[self.currentPruefung].Themen[j].karteiCount[self.getFrageKartei(frage.FRAGEID)]++;
            }
          }
        }
        res.render('choose', {
          Pruefung: self.pruefungen[self.currentPruefung],
          KarteiCount: self.karteiCount
        });
      }
    } else res.redirect('/');
  });

  app.get('/set', function(req, res) {
    if (self.state === 'index') {
      if (req.query.p) self.currentPruefung = req.query.p;
    }
    res.redirect('/');
  });

  app.get('/cancel', function(req, res) {
    if (self.state === 'test') {
      self.state = 'index';
    }
    res.redirect('/');
  });

  app.get('/reset/:id', function(req, res) {
    if (self.state === 'index') {
      if(req.params.id) {
        for (var i = 0; i < self.topics[self.currentPruefung][req.params.id].Fragen.length; i++) {
          var frage = self.topics[self.currentPruefung][req.params.id].Fragen[i];
          if (!frage.IstZusatzFrage) {
            self.resetFrageKartei(frage.FRAGEID);
          }
        }
        res.redirect('/choose');
        return;
      } else {
        self.kartei = {
          2: [],
          3: [],
          4: [],
          5: []
        };
        self.karteiFragen = {};
        self.saveKartei();
      }
    }
    res.redirect('/');
  });
};

DrivingLicense.prototype.shuffle = function(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

DrivingLicense.prototype.getFrage = function(id) {
  if (this.fragen[id] === undefined) {
    try {
      this.fragen[id] = cjson.load(this.dataPath + 'fragen/' + id + '.json');
    } catch (e) {
      return {};
    }
  }

  return this.fragen[id];
};

DrivingLicense.prototype.loadKartei = function() {
  try {
    this.kartei = cjson.load(this.dataPath + 'kartei.json');
  } catch (e) {
    console.log(e)
    this.kartei = {
      2: [],
      3: [],
      4: [],
      5: []
    };
    this.saveKartei();
  }

  this.karteiFragen = {};
  for (var i in this.kartei) {
    for (var j = 0; j < this.kartei[i].length; j++) {
      this.karteiFragen[this.kartei[i][j]] = i;
    }
  }

  this.refreshKarteiCount();
};

DrivingLicense.prototype.saveKartei = function() {
  fs.writeFile(this.dataPath + 'kartei.json', JSON.stringify(this.kartei), function(err) {
    if (err) {} else {}
  });
  this.refreshKarteiCount();
};

DrivingLicense.prototype.getFrageKartei = function(frageid) {
  if (this.karteiFragen[frageid]) return this.karteiFragen[frageid];
  else return 1;
};

DrivingLicense.prototype.resetFrageKartei = function(frageid) {
  if (this.karteiFragen[frageid]) {
    for (var j = 0; j < this.kartei[this.karteiFragen[frageid]].length; j++) {
      if (this.kartei[this.karteiFragen[frageid]][j] === frageid) {
        this.kartei[this.karteiFragen[frageid]].splice(j, 1);
      }
    }
    delete this.karteiFragen[frageid];
  }
  this.saveKartei();
};

DrivingLicense.prototype.pushFragenKartei = function(frageid) {
  var tmp = this.getFrageKartei(frageid);
  if (tmp < 5) {
    this.resetFrageKartei(frageid);
    tmp++;
    this.karteiFragen[frageid] = tmp;
    this.kartei[tmp + ""].push(frageid);
    this.saveKartei();
  }
};

DrivingLicense.prototype.refreshKarteiCount = function() {
  var self = this;

  if (this.karteiFragen === undefined) return;

  this.karteiCount = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  };

  for (var j in self.topics[self.currentPruefung]) {
    for (var i = 0; i < self.topics[self.currentPruefung][j].Fragen.length; i++) {
      var frage = self.topics[self.currentPruefung][j].Fragen[i];
      if (!frage.IstZusatzFrage) {
        self.karteiCount[this.getFrageKartei(frage.FRAGEID)]++;
      }
    }
  }
}

DrivingLicense.prototype.loadData = function() {
  var self = this;

  this.pruefungen = cjson.load(this.dataPath + 'pruefungen.json');
  this.fragen = {};
  this.topics = {};

  Object.keys(this.pruefungen).forEach(function(topic) {
    self.pruefungen[topic].ThemenExtended = {};
    for (var i = 0; i < self.pruefungen[topic].Themen.length; i++) {
      self.pruefungen[topic].ThemenExtended[self.pruefungen[topic].Themen[i].ID] = self.pruefungen[topic].Themen[i];
    }

    self.topics[topic] = cjson.load(self.dataPath + 'themen/' + topic + '.json');

    self.app.get('/themen/' + topic, function(req, res) {
      res.send(self.topics[topic]);
    });
  });

  this.loadKartei();
};

DrivingLicense.prototype.startTest = function() {
  var self = this;
  var isBlocked;

  self.currentZusatz = -1;
  self.currentFrage = 0;
  self.currentFragen.length = 0;
  self.answering = false
  self.isRight = false;

  self.state = 'test';

  for (var j = 0; j < self.currentTopics.length; j++) {
    var lastHauptFrage = 0;
    for (var i = 0; i < self.topics[self.currentPruefung][self.currentTopics[j]].Fragen.length; i++) {
      var frage = self.topics[self.currentPruefung][self.currentTopics[j]].Fragen[i];
      if (!frage.IstZusatzFrage) {
        isBlocked = false;
        if (self.currentKartei > 0 && self.getFrageKartei(frage.FRAGEID) != self.currentKartei) {
          isBlocked = true;
        }
        if (!isBlocked) {
          frage.ZusatzFragen = [];
          lastHauptFrage = self.currentFragen.push(frage) - 1;
        }
      } else {
        if (!isBlocked) {
          frage.Parent = self.currentFragen[lastHauptFrage];
          self.currentFragen[lastHauptFrage].ZusatzFragen.push(frage);
        }
      }
    }
    self.currentFragen = self.shuffle(self.currentFragen);
  }

  if (self.currentFragen.length == 0) {
    self.state = 'index';
    return;
  }

  self.createAnswers(self.getFrage(self.currentFragen[self.currentFrage].FRAGEID));
};

DrivingLicense.prototype.createAnswers = function(frage) {
  this.currentAnswers.length = 0;
  for (var i = 0; i < 4; i++) {
    this.currentAnswers.push({
      text: frage.AntwortText.de[i].Text,
      richtig: frage.AntwortRichtig[i]
    });
  }
  this.currentAnswers = this.shuffle(this.currentAnswers);
};

module.exports = exports = DrivingLicense;