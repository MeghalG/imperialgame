var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require("cors");

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var mapAPIRouter = require("./routes/mapAPI");
var submitAPIRouter = require("./routes/submitAPI");
var proposalAPIRouter = require("./routes/proposalAPI.js");
var buyAPIRouter = require("./routes/buyAPI");
var turnAPIRouter = require("./routes/turnAPI");
var stateAPIRouter = require("./routes/stateAPI");
var miscAPIRouter = require("./routes/miscAPI");

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use("/mapAPI", mapAPIRouter);
app.use("/submitAPI", submitAPIRouter);
app.use("/proposalAPI", proposalAPIRouter);
app.use("/buyAPI", buyAPIRouter);
app.use("/turnAPI", turnAPIRouter);
app.use("/stateAPI", stateAPIRouter);
app.use("/miscAPI", miscAPIRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
