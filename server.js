const express = require('express');
const mongoose =require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const jwt = require("jsonwebtoken");

const app =express();

app.use(express.json());
const corsOptions = {
  origin: "https://todo-frontend-08xp.onrender.com/",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, // You may need to set this depending on your use case
};

app.use(cors(corsOptions));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const dotenv=require("dotenv")
dotenv.config();


const dbURI = process.env.URI;
const PORT=process.env.PORT || 5000;
const baseURl=process.env.BASE_URL;

// Create a connection to MongoDB
mongoose.connect(dbURI).then(()=>{
  console.log("connected to MongoDb");
  app.listen(PORT,(error)=>{
    if(error) console.log(error);
    console.log("server running on",process.env.PORT);
  });
  
}).catch((error)=>{
  console.log("Error",error);

});


const Todo =require('./model/Todo')
const User=require('./model/User')

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, "secret-key");
    const userId = payload.userId;
    console.log("token is ", userId);

    // Find the user by ID
    const user = await User.findById(userId);
    console.log("token is ", user);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Convert image data to base64 string
    const base64Image = user.image.data.toString("base64");

    // Create a modified user object with the encoded image
    const modifiedUser = {
      ...user._doc,
      image: {
        data: base64Image,
        contentType: user.image.contentType,
      },
    };

    req.user = modifiedUser;
    next();
  } catch (error) {
    console.log("errrrrr");
    res.status(401).json({ error: "Unauthorized" });
  }
};


app.post(`/signup`, upload.single('image'), async (req, res) => {
  const { name, email, password } = req.body;
  const { originalname, mimetype, buffer } = req.file;

  try {
    // Check if the email is already registered
    const existingUser = await User.findOne({ email }).maxTimeMS(30000);
    if (existingUser) {
      return res.status(400).send('Email already registered.');
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create a new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      image: {
        data: buffer,
        contentType: mimetype
      },

    });

    await newUser.save();
  
    const token = jwt.sign({ userId: newUser._id }, "secret-key");
    res.setHeader("Authorization", token);
    res.status(200).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error registering user.');
  }
 
});


app.post(`/login`, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email }).maxTimeMS(30000);
    console.log(user);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare the password

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create a JWT token
    const token = jwt.sign({ userId: user._id }, "secret-key");

    // Set the token in the response header
    
    res.status(200).json({ token, message: "Login successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred during login" });
  }
});


app.get(`${baseURl}/todos`,authenticate,async (req,res)=>{

  const userId = req.user._id;

  // Fetch todos where userId matches req.user._id
  const todos = await Todo.find({ userId });
  res.json(todos);

});

app.post(`${baseURl}/todo/new`, authenticate,(req, res) => {
    const todo = Todo({
      text: req.body.text,
      userId:req.user._id,
      priority:req.body.priority
    });
  
    todo.save()
      .then(savedTodo => {
        res.json(savedTodo);
      })
      .catch(error => {
        res.status(500).json({ error: 'An error occurred while saving the todo.' });
      });
  });
  


app.delete(`${baseURl}/todo/delete/:id`,async(req,res)=>{
 
const result= await Todo.findByIdAndDelete(req.params.id);
    res.json(result);
  })

app.get(`https://todo-manager-3eel.onrender.com/test`,async(req,res)=>{
    res.status(200).send('Test okey');
});


app.get(`${baseURl}/todo/complete/:id`, async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    todo.complete = !todo.complete;
    await todo.save();

    res.json(todo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



app.get(`${baseURl}/current-user`, authenticate, async (req, res) => {
  res.status(200).json(req.user);
});



app.put(`${baseURl}/edit-profile`, authenticate, upload.single("image"), async (req, res) => {
  const { email, password, name } = req.body;
  const { user } = req;

  try {
    // Create an object to store the updated fields
    const updatedFields = {};
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // Update user fields if provided
    if (email) updatedFields.email = email;
    if (password) updatedFields.password = hashedPassword;
    if (name) updatedFields.name = name;
    // Update user image if provided
    if (req.file) {
      updatedFields["image.data"] = req.file.buffer;
      updatedFields["image.contentType"] = req.file.mimetype;
    }

    // Update the user using findOneAndUpdate
    const updatedUser = await User.findOneAndUpdate({ _id: user._id }, updatedFields, {
      new: true, // Return the updated user as the result
    });

    // Convert image data to base64 string
    const base64Image = updatedUser.image.data.toString("base64");

    // Create a modified user object with the encoded image
    const modifiedUser = {
      ...updatedUser._doc,
      image: {
        data: base64Image,
        contentType: updatedUser.image.contentType,
      },
    };

    res.status(200).json(modifiedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


