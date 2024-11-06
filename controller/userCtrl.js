const { generateToken } = require('../config/jwtToken');
const { generateRefreshToken } = require('../config/refreshToken');
const User = require('../models/userModel')
const asyncHandler = require('express-async-handler');
const { validateMongoDbId } = require('../utils/validateMongodbid');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('./emailCtrl');

const createUser = asyncHandler(async (req, res) => {
    const email = req.body.email;
    const findUser = await User.findOne({ email: email });
    
    if (!findUser) {
        // Create a new user
        const newUser = await User.create(req.body);
        res.json(newUser);
    } else {
        throw new Error("User Already Exist");     
    }
});

const loginUserCtrl = asyncHandler(async(req, res) => {
    const {email, password} = req.body;
    
    // check if user exists or not
    const findUser = await User.findOne({ email });
    if (findUser && await findUser.isPasswordMatched(password)) {
        const refreshToken = await generateRefreshToken(findUser?._id);
        const updateUser = await User.findByIdAndUpdate(findUser._id, {
            refreshToken: refreshToken,
        }, { new: true });
    
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            maxAge: 72*60*60*1000,
        });
        res.json({
            _id: findUser?._id,
            firstname: findUser?.firstname,
            lastname: findUser?.lastname,
            email: findUser?.email,
            mobile: findUser?.mobile,
            token: generateToken(findUser?._id)
        })
    } else {
        throw new Error("Invalid Credentials")
    }
});

// handle refresh token

const handleRefreshToken = asyncHandler(async (req, res) => {
    const cookie = req.cookies;
    
    if (!cookie?.refreshToken) throw new Error('No refresh token in Cookies');
    const refreshToken = cookie.refreshToken;
    const user = await User.findOne({ refreshToken })
    if (!user) throw new Error('No refresh token present in Db or not matched');

    jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
        if(err || user.id !== decoded.id) {
            throw new Error('There is something wrong whit refresh token')
        }
        const accessToken = generateToken(user?._id);
        res.json({ accessToken })
    })

})

// logout functionality

const logout = asyncHandler(async (req, res) => {
    const cookie = req.cookies;
    if (!cookie?.refreshToken) throw new Error('No refresh token in Cookies');
    const refreshToken = cookie.refreshToken;
    const user = await User.findOne({ refreshToken })

    if(!user){
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true,
        });

        return res.sendStatus(204); //forbidden
    }

    await User.findOneAndUpdate({ refreshToken }, {
        refreshToken: "",
    })
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
    });
    return res.sendStatus(204); //forbidden

})

// update user

const updateUser = asyncHandler(async (req, res) => {
    const { _id } = req.user;
    validateMongoDbId(_id);
    try {
        const updateaUser = await User.findByIdAndUpdate(_id, {
            firstname: req?.body?.firstname,
            lastname: req?.body?.lastname,
            email: req?.body?.email,
            mobile: req?.body?.mobile,
        }, {
            new: true,
        });

        res.json(updateaUser);
    } catch (error) {
        throw new Error(error)
    }
})

// get all users

const getAllUser = asyncHandler(async(req, res) => {
    try {
        const getUsers = await User.find();
        res.json(getUsers);
    } catch (error) {
        throw new Error(error)
    }
})

// get user by id

const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);

    try {
        const findUser = await User.findById(id);
        res.json(findUser);
    } catch (error) {
        throw new Error("Usuário não encontrado")
    }
})

// delete user

const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);

    try {
        const findUser = await User.findByIdAndDelete(id);
        res.json(findUser);
    } catch (error) {
        throw new Error("Usuário não encontrado")
    }
})

const blockUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);

    try {
        const blockUser = await User.findByIdAndUpdate(id, {
            isBlocked: true,
        }, {
            new: true,
        })
        res.json({
            message: "User Blocked",
        })
    } catch (error) {
        throw new Error(error)
    }
})

const unblockUser = asyncHandler(async (req, res) => {
    const {id} = req.params;
    validateMongoDbId(id);

    try {
        const unblockUser = await User.findByIdAndUpdate(id, {
            isBlocked: false,
        }, {
            new: true,
        })
        res.json({
            message: "User Unblocked",
        })
    } catch (error) {
        throw new Error(error)
    }
})

const updatePassword = asyncHandler(async (req, res) => {
    const {_id} = req.user;
    const { password } = req.body;
    validateMongoDbId(_id);
    const user = await User.findById(_id);
    if (password) {
        user.password = password;
        const updatedPassword = await user.save();
        res.json(updatedPassword);
    } else {
        res.json(user);
    }
})

const forgotPasswordToken = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) throw new Error("User not found with this email");
    try {
        const token = await user.createPasswordResetToken();
        await user.save();
        const resetURL = `Hi, please follow this link to reset Tour Password. This link is valid till 10 minutes from now. <a href='http://localhost:5000/api/user/reset-password/${token}'>Click here</a>`;
        const data = {
            to: email,
            subject: "Forgot Password Link",
            htm: resetURL,
            text: "Hey User",
        }
        sendEmail(data);
        res.json(token);
    } catch (error) {
        throw new Error(error);
    }
    
})

const resetPassword = asyncHandler(async (req, res) => {
    const { password } = req.body;
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: {$gt:Date.now()}
    });

    if (!user) throw new Error("Token Expired, Please try again later");
    user.password = password;
    user.passwordResetToken=undefined;
    user.passwordResetToken=undefined;
    await user.save();
    res.json(user);
})

module.exports={
    createUser,
    loginUserCtrl,
    getAllUser,
    getUserById,
    deleteUser,
    updateUser,
    blockUser,
    unblockUser,
    handleRefreshToken,
    logout,
    updatePassword,
    forgotPasswordToken,
    resetPassword,
};

