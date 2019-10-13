var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var UserSchema = new mongoose.Schema({
    username: {type: String, unique: true, required: true}, //prevents multiple users with the same username
    password: String,
	avatar: String, //add a default avatar later
	firstName: String,
	lastName: String,
	email: {type: String, unique: true, required: true}, //prevents multiple users with the same email
	resetPasswordToken: String,
	resetPasswordExpires: Date,
	isAdmin: { type: Boolean, default: false },
	notifications: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Notification"
		}
	],
	followers: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "User"
		}
	]
});

UserSchema.plugin(passportLocalMongoose)

module.exports = mongoose.model("User", UserSchema);