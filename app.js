var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var GoogleStrategy = require('passport-google').Strategy;
var util = require('util');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');

// Custom libs
var dynamo = require('./lib/dynamo');

// Redis Session Store
var session = require('express-session')
var RedisStore = require('connect-redis')(session);



// SOME CONFIGS
AWS.config.loadFromPath('./aws.json');
var S3_BUCKET = 'fotkich';
var GOOGLE_RETURN_URL = 'http://localhost:3000/auth/google/return';
var GOOGLE_REALM = 'http://localhost:3000/';
var CDN_PREFIX = 'http://cdn.fotkich.com/';

// Google Auth Strategy
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

var ensureAuthenticated = function(req, res, next){
  if (!req.isAuthenticated())
    res.send(401);
  else
    next();
};


passport.use(new GoogleStrategy({
  returnURL: GOOGLE_RETURN_URL,
  realm: GOOGLE_REALM
},
function(identifier, profile, done) {
  process.nextTick(function () {      
    var email = profile.emails[0].value;
    profile.identifier = identifier;
      // only teamcmp folks can join
      console.log(profile);
      if (email.indexOf('\@') > 0) {
        return done(null, profile);
      }
      else {
        return done(null, false, { message: 'Wrong company' });
      }

      
    });
}
));



var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('teamcmp secret'));

app.use(express.session({ store: new RedisStore({host:'localhost', port:6379, prefix:'chs-sess'}), secret: 'SEKR37' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(require('stylus').middleware(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'public')));



app.get('/',  function(req, res){
  res.render('index');
});

app.get('/login',  function(req, res){
  res.render('index');
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/feed');
});

app.get('/feed', ensureAuthenticated, function(req, res){
  res.render('feed');
});

// Simple API
app.get('/api/v1/media', ensureAuthenticated, function(req, res){
  dynamo.getMediaGroups((new Date()).getTime()-1000*60*3000,function(data) {
    res.send({'status' : 'ok',
      'data' : data});
  });    
});

app.get('/api/v1/files/:groupId', ensureAuthenticated, function(req, res){
  dynamo.getMediaGroupFiles(req.params.groupId,function(data) {
    res.send({'status' : 'ok',
      'data' : data});
  });    
});

app.get('/api/v1/comments/:groupId', ensureAuthenticated, function(req, res){
  dynamo.getMediaGroupComments(req.params.groupId,function(data) {
    res.send({'status' : 'ok',
      'data' : data});
  });    
});

app.post('/api/v1/comments', ensureAuthenticated, function(req, res){
  dynamo.addCommentToMediaGroup(req.body.groupId,req.body.comment,req.user.displayName,function(data) {
    res.send({'status' : 'ok',
      'data' : data});
  });    
});


app.post('/api/v1/upload',function(req, res) {
  var files = req.files.groupFiles;
  var proced = {};
  var processed = 0;
  var total = files.length;
  var newBanner = req.body.newBanner;


  // supporting one file upload
  if (files.path) {
    var oneFile = [files];
    files = oneFile;
    total = 1;  
  }   


  // Creating new Media Group
  dynamo.createNewMediaGroup(req.body.groupName,req.body.groupDescription,req.user.displayName,function(data){
    startUploading(data['Item']['ID']['S']);
  });  


  var startUploading = function(mediaGroupId) {

    var filesToProcess = {};
    for (var file in files) {
      filesToProcess[files[file].path] = files[file];
    }
    console.log('FIles to process',Object.keys(filesToProcess));

    var uploadFileToS3 = function (filePath,newName,contentType,callback,callbackError) {


      console.log('Starting upload',filePath,newName)
      require('fs').readFile(filePath, function (err, data) {
        if (err) { throw err; }
        var s3 = new AWS.S3();
        var params1 = {Bucket: S3_BUCKET, ContentType: contentType, Key: newName, Body: data, ACL: "public-read"};  
        s3.putObject(params1, function(err, rdata) {
          if (err) {
            callbackError(err);
          } else {
            dynamo.addFileToMediaGroup(mediaGroupId,CDN_PREFIX+newName,contentType,function(data){          
              console.log('Uploading is done',"https://s3.amazonaws.com/Fotkich/"+newName )
            });        
            callback();
          }
        });
      });
    }

    var beingUploaded = 0;
    var uploadedFiles = [];
    var sentHeader = false;

    var uploadFiles = function() {
      console.log('Calling uploadFiles', beingUploaded,Object.keys(filesToProcess))
      if (beingUploaded < 5 && Object.keys(filesToProcess).length > 0) {
        beingUploaded = beingUploaded + 1;
        var filePath = Object.keys(filesToProcess)[0];
        var file = filesToProcess[filePath];
        uploadedFiles.push(file);
        uploadFileToS3(file.path,uuid.v4()+file.name,file.type,function(){
          beingUploaded = beingUploaded - 1;          
          uploadFiles();
        },function(){
          beingUploaded = beingUploaded - 1;
          uploadFiles();
        });           
        delete filesToProcess[file.path];
        uploadFiles();       
      }
      if (Object.keys(filesToProcess) == 0 && !sentHeader) {
        sentHeader = true;
        res.redirect('/feed');
      }
    }

    uploadFiles();    
  }

});










// Google Auth
app.get('/auth/google', passport.authenticate('google'));
app.get('/auth/google/return', 
  passport.authenticate('google', { successRedirect: '/feed',
    failureRedirect: '/login' }));

module.exports = app;
