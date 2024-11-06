const nodemailer = require("nodemailer");
const asyncHandler = require('express-async-handler');


const sendEmail = asyncHandler(async (data, req, res) => {
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // true for port 465, false for other ports
            auth: {
              user: process.env.MAIL_ID,
              pass: process.env.MP,
            },
          });
    
          const info = await transporter.sendMail({
            from: 'Hey 👻" <teste@gmail.com>', // sender address
            to: data.to, // list of receivers
            subject: data.subject, // Subject line
            text: data.text, // plain text body
            html: data.htm, // html body
          });
        
    } catch (error) {
        throw new Error(error);
    }
    
      console.log("Message sent: %s", info.messageId);

      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

})

module.exports = {
    sendEmail
}

