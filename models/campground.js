var mongoose = require("mongoose");

var campgroundSchema = new mongoose.Schema({
	name: String,
	image: String,
	imageId: String,
	description: String,
	location: String,
	cost: Number,
	lat: Number,
	lng: Number,
	createdAt: { type: Date, default: Date.now },
	author: {
	  id: {
		 type: mongoose.Schema.Types.ObjectId,
		 ref: "User"
	  },
	  username: String
	},
	comments: [
	  {
		 type: mongoose.Schema.Types.ObjectId,
		 ref: "Comment"
	  }
	],
	//hold ObjectId references to the particular users who like the campground (the array will store User model ObjectId references)
	likes: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		}
	]
});

module.exports = mongoose.model("Campground", campgroundSchema);