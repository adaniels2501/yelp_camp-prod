require('dotenv').config();

const express    		= require('express'),
      app        		= express(),
      bodyParser 		= require('body-parser'),
      mongoose   		= require('mongoose'),
	  passport   		= require('passport'),
	  LocalStrategy 	= require('passport-local'),
	  methodOverride	= require('method-override'),
	  flash				= require('connect-flash'),
	  cookieParser 		= require("cookie-parser"),
	  Campground 		= require('./models/campground'),  
	  //referencing and importing the model and schema from campground.js in models
	  Comment	 		= require('./models/comment'),
  	  seedDB	 		= require('./seeds'),
	  User		 		= require('./models/user'),
	  url 				= process.env.MONGOLAB_URI,
	  adminCode			= process.env.ADMIN_SEKRET

	//REQUIRING ROUTES
const commentRoutes 	= require('./routes/comments'),
	  campgroundRoutes	= require('./routes/campgrounds'),
	  indexRoutes		= require('./routes/index')


mongoose.connect(url, {
	useNewUrlParser: true,
	useCreateIndex: true
}).then(() => {
	console.log('Connected to DB!');
}).catch(err => {
	console.log('ERROR', err.message);
});

// mongoose.connect('mongodb://localhost:27017/yelp_camp_final', {useNewUrlParser: true, useUnifiedTopology: true});


mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());
// seedDB(); //seed the database

//require moment
app.locals.moment = require('moment');

// PASSPORT CONFIGURATION
app.use(require("express-session")({
    secret: "Chivers Unite!",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(async function(req, res, next){
	res.locals.currentUser = req.user;
	if(req.user) {
		try {
			let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
			res.locals.notifications = user.notifications.reverse();
		} catch(err) {
			console.log(err.message);
		}
	}
		res.locals.error = req.flash("error");
		res.locals.success = req.flash("success");
		next();
});

app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/comments", commentRoutes);


app.listen(3000, () => {
	console.log('YelpCamp listening on port 3000');
})