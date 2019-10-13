const express 		= require("express"),
	  router  		= express.Router(),
	  Campground 	= require("../models/campground"),
	  middleware 	= require("../middleware"),
	  multer		= require("multer"),
	  Notification  = require("../models/notification"),
	  User			= require("../models/user")
	

//MULTER CONFIGURATION
var storage = multer.diskStorage({
  	filename: function(req, file, callback) {
    	callback(null, Date.now() + file.originalname);
	}
});

var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

//CLOUDINARY CONFIGURATION
var cloudinary = require('cloudinary');
cloudinary.config({
	cloud_name: 'yelpcamp2019webdevbootcamp',
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});


//GOOGLE MAPS CONFIGURATION FOR GEOCODER API
var NodeGeocoder = require('node-geocoder');
 
var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
var geocoder = NodeGeocoder(options);

//INDEX - show all campgrounds
router.get("/", function(req, res){
	//fuzzy search. grabs the function at the bottom and plugs it in to grab the search string
	if(req.query.search) {
		const regex = new RegExp(escapeRegex(req.query.search), 'gi');
		// Get all campgrounds from DB
		// we can plug it into the find to search through the names only of the campground
		Campground.find({name: regex}, function(err, allCampgrounds){
		   if(err || !allCampgrounds){
			   req.flash('error', 'Sorry, that campground cannot be located.');
			   res.redirect('/campgrounds');
			   console.log(err);
		   } else {
			   if(allCampgrounds.length === 0) {
				   req.flash("error", "Sorry, no campgrounds match that search, please try again.");
				   return res.redirect('/campgrounds');
			   }
			  res.render("campgrounds/index", {campgrounds: allCampgrounds, page: 'campgrounds'});
		   }
		});
	} else {	
		// Get all campgrounds from DB
        Campground.find({}, function(err, allCampgrounds){
           if(err){
               console.log(err);
           } else {
              res.render("campgrounds/index",{campgrounds: allCampgrounds, page: 'campgrounds'});
           }
        });
	}
});

//CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single('image'), function(req, res){
	geocoder.geocode(req.body.location, function (err, data) {
		if (err || !data.length) {
			console.log('error from post: ' + err);
			req.flash('error', 'Invalid address');
			return res.redirect('back');
		}
		req.body.campground.lat = data[0].latitude;
		req.body.campground.lng = data[0].longitude;
		req.body.campground.location = data[0].formattedAddress;
		cloudinary.v2.uploader.upload(req.file.path, async function(err, result) {
			if(err) {
				req.flash('error', err.message);
				console.log(err);
				return res.redirect('back');
			}
			// add cloudinary url for the image to the campground object under image property
			req.body.campground.image = result.secure_url;
			// add image's public_id to campground object
			req.body.campground.imageId = result.public_id;
			// add author to campground
			req.body.campground.author = {
				id: req.user._id,
				username: req.user.username
			}
			//req.body.campground contains all of the information about the form so removed the variables and additional callback
			try {
				let campground = await Campground.create(req.body.campground);
				let user = await User.findById(req.user.id).populate('followers').exec();
				let newNotification = {
					username: req.user.username,
					campgroundId: campground.id
				}
				for (const follower of user.followers) {
					let notification = await Notification.create(newNotification);
					follower.notifications.push(notification);
					follower.save();
				}
				//redirect back to the campgrounds page
				res.redirect(`/campgrounds/${campground.id}`);
			} catch(err) {
				req.flash('error', 'err.message');
				console.log(err + ' from catch');
				res.redirect('back')
			}
		});
	});
});

//NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, function(req, res){
   res.render("campgrounds/new"); 
});

// SHOW - shows more info about one campground
router.get("/:id", function(req, res){
    //find the campground with provided ID
	//access details of the users who liked the campground for the "LIKES" feature
    Campground.findById(req.params.id).populate("comments likes").exec(function(err, foundCampground){
        if(err){
            console.log(err);
        } else {
            // console.log(foundCampground)
            //render show template with that campground
            res.render("campgrounds/show", {campground: foundCampground});
        }
    });
});

// EDIT CAMPGROUND ROUTE
router.get("/:id/edit", middleware.checkCampgroundOwnership, function(req, res){
    Campground.findById(req.params.id, function(err, foundCampground){
        res.render("campgrounds/edit", {campground: foundCampground});
    });
});

//UPDATE CAMPGROUND ROUTE 
router.put('/:id', upload.single('image'), middleware.checkCampgroundOwnership, function(req, res) {
	Campground.findById(req.params.id, function(err, campground) {
		if(err) {
			req.flash('error', err.message);
			res.redirect('back');
		} else {
			geocoder.geocode(req.body.location, async function(err, data) {
				if(err) {
					req.flash('error', 'Error geocoding map');
					console.log(err);
				}
				campground.lat = data[0].latitude;
				campground.lng = data[0].longitude;
				campground.location = data[0].formattedAddress;
				//if the user is trying to upload a new file
				if(req.file) {
					try {
						//if the user is uploading a new image, find the original and destroy before adding new
						if(campground.imageid) {
							await cloudinary.v2.uploader.destroy(campground.imageId);
						}
						//upload the new file submitted by the user
						var result = await cloudinary.v2.uploader.upload(req.file.path);
						//add image's public_id from cloudinary to the campground object
						campground.imageId = result.public_id;
						//add cloudinary url for the image to the campground object under image property
						campground.image = result.secure_url;
					} catch (err) {
						req.flash('error', 'err.message');
						res.redirect('back');
					}
				}
				//update the rest of the information from the form if there is a change
				campground.name = req.body.campground.name;
				campground.description = req.body.campground.description;
				campground.cost = req.body.campground.cost;
				//save to the database. this is important because we are saving from querying the database again
				campground.save();
				req.flash('success', 'Successfully updated campground: ' + campground.name);
				res.redirect('/campgrounds/' + campground._id);
			});
		}
	});
});

//"LIKES" CAMPGROUND ROUTE
router.post('/:id/like', middleware.isLoggedIn, function(req, res) {
	//find the specific campground by its id
	Campground.findById(req.params.id, function(err, foundCampground) {
		if(err) {
			req.flash('error', err.message);
			res.redirect('back');
		}	
	// check the foundCampground.likes array to see if a user already liked a campground
	//some() method will iterate over the foundCampground.likes array, calling equals() on each element (ObjectId) to see if it matches
	//req.user._id and stop as soon as it finds a match. If it finds a match it returns true, otherwise it returns false, and we store 
	//that boolean value to the foundUserLike variable
	var foundUserLike = foundCampground.likes.some(function(like) {
		return like.equals(req.user._id);
	});
		// use the if statement to check the value of foundUserLike. If it is true, that means the user already liked a campground, and that
		//they are clicking the Like button again in order to remove their like. We use the mongoose pull() method to remove the user ObjectId
		//from the array
		if(foundUserLike) {
			//user already liked, removing like
			foundCampground.likes.pull(req.user._id);
		} else {
			//adding the new user like
			// user was not found (if they did not like the campground previously), therefore we add the user ObjectId to the likes array using
			//the push() method.
			foundCampground.likes.push(req.user);
		}
		foundCampground.save(function(err) {
			if(err) {
				req.flash('error', err.message);
				res.redirect('back');
			}
			return res.redirect('/campgrounds/' + foundCampground._id);
		});
	});
});

//DESTROY CAMPGROUND ROUTE
router.delete("/:id", middleware.checkCampgroundOwnership, function(req, res){
	Campground.findById(req.params.id, async function(err, campground){
		if(err) {
			req.flash('error', err.message);
			res.redirect('back');
		}
		try {
			await cloudinary.v2.uploader.destroy(campground.imageId);
				campground.remove();
				req.flash('success', 'Campground successfully deleated!');
				res.redirect("/campgrounds");
		} catch(err) {
			if(err) {
				req.flash('error', err.message);
				res.redirect('back');
			}
		}
	});
});


function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};


module.exports = router;

