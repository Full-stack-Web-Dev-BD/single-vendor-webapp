const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const User = require("./models/User");
const Category = require("./models/Category");
const Product = require("./models/Product");
const Order = require("./models/Order");

const bcrypt= require('bcryptjs')
const app = express();

app.use(express.json());

// mongoose.connect("mongodb://localhost/single-vendor-webapp", {
  mongoose.connect("mongodb+srv://dappmaster:kollol@cluster0.actqmgr.mongodb.net/single-vendor-webapp?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true, //this option not supported
  })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));
  // In the connection i added  some extra  line  to show the  database status connected or not connected

// updated  authencateAdmin  prev on not working 
  const authenticateAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]?.trim();
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const decoded = jwt.verify(token, "secret-key");
      const user = await User.findById(decoded.id);
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      req.user = user;
      next();
    } catch (err) {
      res.status(401).json({ message: "Unauthorized" });
    }
  };
  

// Admin API endpoints for Order Management
app.get("/admin/orders", authenticateAdmin, async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const orders = await Order.find(filter).populate("user items.product");
  res.json(orders);
});

app.get("/admin/orders/:id", authenticateAdmin, async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "user items.product"
  );
  if (!order) {
    res.status(404).json({ message: "Order not found" });
  } else {
    res.json(order);
  }
});

app.put("/admin/orders/:id", authenticateAdmin, async (req, res) => {
  const { status } = req.body;
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).populate("user items.product");
  if (!order) {
    res.status(404).json({ message: "Order not found" });
  } else {
    res.json({ message: "Order updated", order });
  }
});

// Admin API endpoints

// Categories
app.post("/admin/categories", authenticateAdmin, async (req, res) => {
  const category = new Category(req.body);
  await category.save();
  res.json({ message: "Category created", categoryId: category._id });
});

app.put("/admin/categories/:id", authenticateAdmin, async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!category) {
    res.status(404).json({ message: "Category not found" });
  }
  res.json({ message: "Category updated", category });
});

app.delete("/admin/categories/:id", authenticateAdmin, async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) {
    res.status(404).json({ message: "Category not found" });
  }
  res.json({ message: "Category deleted" });
});

// Products
app.post("/admin/products", authenticateAdmin, async (req, res) => {
  const product = new Product(req.body);
  await product.save();
  res.json({ message: "Product created", productId: product._id });
});

app.put("/admin/products/:id", authenticateAdmin, async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!product) {
    res.status(404).json({ message: "Product not found" });
  }
  res.json({ message: "Product updated", product });
});

app.delete("/admin/products/:id", authenticateAdmin, async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    res.status(404).json({ message: "Product not found" });
  }
  res.json({ message: "Product deleted" });
});

// Users
app.get("/admin/users", authenticateAdmin, async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Middleware for user authentication
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]?.trim();
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, "secret-key");
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// Cart API endpoints
app.post("/cart", authenticate, async (req, res) => {
  const { productId } = req.body;
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  req.user.cart.push(product);
  await req.user.save();
  res.json({ message: "Product added to cart" });
});

app.put("/cart/:id", authenticate, async (req, res) => {
  const { quantity } = req.body;
  const item = req.user.cart.id(req.params.id);
  if (!item) {
    return res.status(404).json({ message: "Cart item not found" });
  }
  item.quantity = quantity;
  await req.user.save();
  res.json({ message: "Cart item updated" });
});

// this api updated as  prev one not working
app.delete("/cart/:id", authenticate, async (req, res) => {
  const itemId = req.params.id;
  const cartItem = req.user.cart.find((item) => item._id.toString() === itemId);
  if (!cartItem) {
    return res.status(404).json({ message: "Item not found in cart" });
  }
  req.user.cart = req.user.cart.filter((item) => item._id.toString() !== itemId);
  await req.user.save();
  res.json({ message: "Item removed from cart" });
});

app.get("/cart", authenticate, async (req, res) => {
  const cartItems = req.user.cart;  
  res.json(cartItems);
});


// Order API endpoint
app.post("/orders", authenticate, async (req, res) => {
  const { shippingAddress, billingAddress } = req.body;
  const order = new Order({
    user: req.user._id,
    items: req.user.cart,
    shippingAddress,
    billingAddress,
  });
  await order.save();
  // Clear the user's cart
  req.user.cart = [];
  await req.user.save();
  res.json({ message: "Order placed successfully", orderId: order._id });
});
// Categories API endpoints
app.get("/categories", async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
});

app.get("/categories/:id/products", async (req, res) => {
  const products = await Product.find({ category: req.params.id });
  res.json(products);
});

// Products API endpoints
app.get("/products", async (req, res) => {
  const { search, minPrice, maxPrice } = req.query;
  let query = Product.find();
  if (search) {
    query.where("name", { $regex: search, $options: "i" });
  }
  if (minPrice) {
    query.where("price", { $gte: minPrice });
  }
  if (maxPrice) {
    query.where("price", { $lte: maxPrice });
  }
  const products = await query.exec();
  res.json(products);
});

app.get("/products/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }
  res.json(product);
});
// Configure the email transporter (use a real email and password)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "alminpublic12@gmail.com",
    pass: "alaminpublic",
  },
});

app.post("/auth/reset-password", async (req, res) => {
  const { phoneNumber } = req.body;
  const user = await User.findOne({ phoneNumber });

  if (!user) {
    return res.status(404).json({ message: "Phone number not found" });
  }

  const token = crypto.randomBytes(20).toString("hex");
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  await user.save();

  const mailOptions = {
    from: "youremail@gmail.com",
    // Assuming the user model has an email field
    to: user.email,
    subject: "Password Reset",
    text: `You are receiving this because you or (someone else) have requested the reset of the password for your account.\n\n
    Please click on the following link, or paste this into your browser to complete the process:\n\n
    //localhost:3000/auth/reset-password/${token}\n\n
    If you did not request this, please ignore this email and your password will remain unchanged.\n`,
  };

  transporter.sendMail(mailOptions, (err, response) => {
    if (err) {
      console.error("Error:", err);
    } else {
      res.json({ message: "Password reset email sent" });
    }
  });
});

app.post("/auth/reset-password/:token", async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ message: "Password successfully reset" });
});

app.post('/auth/signup', async (req, res) => {
  const { phoneNumber, password } = req.body;
 
  if (!phoneNumber || !password) {
   return res.status(400).json({ message: 'Missing phone number or password' });
  }
 
  const existingUser = await User.findOne({ phoneNumber });
 
  if (existingUser) {
   return res.status(400).json({ message: 'Phone number already registered' });
  }
 
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
   phoneNumber,
   password: hashedPassword,
   isAdmin: false,
  });
 
  await user.save();
  const token = jwt.sign({ userId: user._id }, 'your_jwt_secret', { expiresIn: '1d' });
  res.json({ message: 'User registered successfully', token });
 });
 
app.post('/auth/guest', async (req, res) => {
  const phoneNumber = 'Guest' + Date.now();
  const hashedPassword = await bcrypt.hash('guest', 10);
 
  const user = new User({
   phoneNumber,
   password: hashedPassword,
   isAdmin: false,
   isGuest: true,
  });
 
  await user.save();
  const token = jwt.sign({ userId: user._id }, 'your_jwt_secret', { expiresIn: '1d' });
  res.json({ message: 'Guest user created successfully', token });
 });
 
app.post("/auth/login", async (req, res) => {
  const { phoneNumber, password } = req.body;
  const user = await User.findOne({ phoneNumber });
  if (!user) {
    return res
      .status(400)
      .json({ message: "Invalid phone number or password" });
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res
      .status(400)
      .json({ message: "Invalid phone number or password" });
  }
  const token = jwt.sign({ id: user._id }, "secret-key", { expiresIn: "7d" });
  res.json({ token });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
