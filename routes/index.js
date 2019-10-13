const express 	    = require("express"),
	  router  		= express.Router(),
	  passport 		= require("passport"),
	  User 			= require("../models/user"),
	  Campground  	= require("../models/campground"),
	  nodemailer	= require('nodemailer'),
	  crypto		= require('crypto'),
	  middleware	= require('../middleware'),
	  Notification 	= require('../models/notification'),
	  async			= require('async')


//ROOT ROUTE
router.get("/", function(req, res){
    res.render("landing");
});

//SHOW REGISTER FORM
router.get("/register", function(req, res){
   res.render("register", {page: 'register'}); 
});

//SIGN UP LOGIC
router.post("/register", function(req, res){
    // var newUser = new User({username: req.body.username});  //original line of code
	//adding locus for admin functionality. locus lets us debug or look at the data about to be passed into the database
	//when the code runs, it hangs and runs the eval function.  At that point the terminal should fire locus because isAdmin is false by default. we can see what locus is doing by typing in newUser which is the variable above. when we do we should see something like this: 
	
				//	newUser
				//	{ isAdmin: false,
				//	_id: 5d9a5a29399f320426e179da,
				//   username: 'admin' }
	// if we do a req.body conditional we will see what the values are that were entered into the form.
	// then we can set the admin property for the admin user that was just created by:
				//	newUser.isAdmin = true
	// we type "exit" to get out of the console and the code will complete running and create the admin user
	// the eval function is then commented out because it's not left for production and corresponding code is placed in its place
	
	// eval(require('locus'));
	var newUser = new User({
			username: req.body.username, 
			firstName: req.body.firstName, 
			lastName: req.body.lastName,
			email: req.body.email,
			avatar: req.body.avatar
	});
	
	if (req.body.adminCode === process.env.ADMIN_SEKRET) {
		newUser.isAdmin = true;
	}
	
    User.register(newUser, req.body.password, function(err, user){
        if(err) {
			console.log(err);
			return res.render("register", {error: err.message});
		}
        passport.authenticate("local")(req, res, function(){
           req.flash("success", "Successfully Signed Up! Nice to meet you " + req.body.username);
           res.redirect("/campgrounds"); 
        });
    });
});

//SHOW LOGIN FORM
router.get("/login", function(req, res){
   res.render("login", {page: 'login'}); 
});

//LOGIN ROUTE
router.post("/login", passport.authenticate("local", 
    {
        successRedirect: "/campgrounds",
        failureRedirect: "/login"
    }), function(req, res){
});

//LOGOUT ROUTE
router.get("/logout", function(req, res){
   req.logout();
   req.flash("success", "Logged you out!");
   res.redirect("/campgrounds");
});

//FORGOT PASSWORD ROUTE
router.get('/forgot', function(req, res) {
	res.render('forgot');
});

router.post('/forgot', function(req, res) {
	async.waterfall([
		function(done) {
			crypto.randomBytes(20, function(err, buf) {
				var token = buf.toString('hex');
				done(err, token); //THE TOKEN CREATED IS THE ONE THAT IS SENT AS PART OF THE URL TO THE USERS EMAIL ADDRESS
			});
		},
		function(token, done) {
			User.findOne({ email: req.body.email }, function(err, user) { //FIND THE PERSONS EMAIL
				if(!user) {
					req.flash('error', 'No account with that email address exists!');
					return res.redirect('/forgot');
				}
				user.resetPasswordToken   = token;
				user.resetPasswordExpires = Date.now() + 3600000; //1 hour reset window
				
				user.save(function(err) {
					done(err, token, user);
				});
			});
		},
		function(token, user, done) {
			var smtpTransport = nodemailer.createTransport({
				service: 'Gmail',
				auth: {
					user: 'yelpcampadm1n@gmail.com',
					pass: process.env.GMAILPW
				}
			});
			var mailOptions = {
				to: user.email,
				from: 'yelpcampadm1n@gmail.com',
				subject: 'YelpCamp Password Reset',
				text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
					  'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
					  'http://' + req.headers.host + '/reset/' + token + '\n\n' +
					  'If you did not request this, please ignore this email and your password will remain unchanged.\n'
			};
			smtpTransport.sendMail(mailOptions, function(err) {
				console.log('MAIL SENT');
				req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
				done(err, 'done');
			});
		}
	], function(err) {
		if(err) return next(err);
		res.redirect('/forgot');
	});
});

router.get('/reset/:token', function(req, res) {
	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
		if(!user) {
			req.flash('error', 'Password reset token is invalid or has expired.');
			return res.redirect('/forgot');
		}
		res.render('reset', {token: req.params.token});
	});
});

router.post('/reset/:token', function(req, res) {
	async.waterfall([
		function(done) {
			User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
				if(!user) {
					req.flash('error', 'Password reset token is invalid or has expired');
					return res.redirect('back');
				}
				if(req.body.password === req.body.confirm) {
					user.setPassword(req.body.password, function(err) {
						//once the process is complete we remove the password token and the expiration from the user
						user.resetPasswordToken = undefined;
						user.resetPasswordExpires = undefined;
						//update user in the database
						user.save(function(err) {
							req.logIn(user, function(err) {
								done(err, user);
							});
						});
					})
				} else {
					req.flash('error', 'Passwords do not match.');
					return res.redirect('back');
				}
			});
		},
		function(user, done) {
			var smtpTransport = nodemailer.createTransport({ 
				service: 'Gmail',
				auth: {
					user: 'yelpcampadm1n@gmail.com',
					pass: process.env.GMAILPW
				}
			});
			var mailOptions = {
				to: user.email,
				from: 'yelpcampadm1n@gmail.com',
				subject: 'Your password has been changed',
				text: 'Hello,\n\n' + 
					  'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
			};
			smtpTransport.sendMail(mailOptions, function(err) {
				req.flash('success', 'Success! Your password has been changed.');
				done(err);
			});
		}
	], function(err) {
		res.redirect('/campgrounds');
	});
});

//CREATING USER PROFILE ROUTE
router.get('/users/:id', async function(req, res) {
	try {
		let user = await User.findById(req.params.id).populate('followers').exec();
		Campground.find().where('author.id').equals(user._id).exec(function(err, campgrounds) {
			if(err) {
				req.flash('error', err.message);
				res.redirect('/');
			}
			res.render('users/show', { user, campgrounds });
		});
	} catch(err) {
		req.flash('error', err.message);
		return res.redirect('back');
	}
});

//FOLLOW USER ROUTE
router.get('/follow/:id', middleware.isLoggedIn, async function(req, res) {
	try {
		let user = await User.findById(req.params.id);
			user.followers.push(req.user._id);
			user.save();
			req.flash('success', 'Successfully following ' + user.username.charAt(0).toUpperCase() + user.username.slice(1) + '!');
			res.redirect('/users/' + req.params.id);
	} catch (err) {
		req.flash('error', 'Unable to follow ' + user.username + '.');
		res.redirect('back');
	}
});

//VIEW ALL NOTIFICATIONS
router.get('/notifications', middleware.isLoggedIn, async function(req, res) {
	try {
		let user = await User.findById(req.user._id).populate({
  			path: 'notifications',
  			options: { sort: { "_id": -1 } }
		}).exec();
		let allNotifications = user.notifications;
			res.render('notifications/index', { allNotifications });
	} catch(err) {
		req.flash('error', err.message);
		res.redirect('back');
	}
});

//HANDLE NOTIFICATIONS
router.get('/notifications/:id', middleware.isLoggedIn, async function(req, res) {
	try {
		let notification = await Notification.findById(req.params.id);
			notification.isRead = true;
			notification.save();
			res.redirect(`/campgrounds/${notification.campgroundId}`);
	} catch(err) {
			req.flash('error', err.message);
			res.redirect('back');
	}
});

module.exports = router;