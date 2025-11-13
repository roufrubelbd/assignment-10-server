const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tjqypvp.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // Define database and collections
    const database = client.db("businessHub");
    const productsCollection = database.collection("products");
    const importsCollection = database.collection("imports");
    const exportsCollection = database.collection("exports");

    // GET - products with optional limit to 6
    app.get("/products", async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 0;
        const products = await productsCollection
          .find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray();
        res.send(products);
      } catch (err) {
        // console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // GET - all products
    app.get("/products", async (req, res) => {
      try {
        const products = await productsCollection.find({}).toArray();
        res.send(products);
      } catch (err) {
        // console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // GET - single product by ID
    app.get("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const product = await productsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!product)
          return res.status(404).send({ message: "Product not found" });
        res.send(product);
      } catch (err) {
        // console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // POST - exports
    app.post("/exports", async (req, res) => {
      try {
        const newProduct = req.body;
        if (!newProduct.name || !newProduct.image) {
          return res
            .status(400)
            .send({ success: false, message: "Missing fields" });
        }

        await exportsCollection.insertOne(newProduct);
        await productsCollection.insertOne(newProduct);
        res
          .status(201)
          .send({ success: true, message: "Product exported successfully" });
      } catch (error) {
        // console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // POST - imports
    app.post("/imports/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { quantity, userEmail } = req.body;
        const product = await productsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!product) {
          return res.status(404).send({ message: "Product not found" });
        }

        if (quantity <= 0 || quantity > product.availableQuantity) {
          return res.status(400).send({ message: "Invalid quantity" });
        }

        // Save imported full product details to imports collection
        const importData = {
          productId: id,
          name: product.name,
          image: product.image,
          price: product.price,
          rating: product.rating,
          originCountry: product.originCountry,
          category: product.category,
          importedQuantity: quantity,
          userEmail,
          importedAt: new Date(),
        };

        await importsCollection.insertOne(importData);

        // Reduce available quantity in products collection
        await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { availableQuantity: -quantity } }
        );

        res.send({ message: "Imported successfully" });
      } catch (error) {
        // console.error(error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // GET - imported products by logged-in user email
    app.get("/imports", async (req, res) => {
      const { email } = req.query;
      const result = await importsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    // DELETE - delete an imported product by ID
    app.delete("/imports/:id", async (req, res) => {
      const id = req.params.id;
      const result = await importsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      if (result.deletedCount > 0) {
        res.send({ success: true, message: "Product deleted successfully" });
      } else {
        res.status(404).send({ success: false, message: "Product not found" });
      }
    });

    // GET - Exported products by logged-in user email
    app.get("/exports", async (req, res) => {
      const { email } = req.query;
      const result = await exportsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    // DELETE - delete an exported product by ID
    app.delete("/exports/:id", async (req, res) => {
      const id = req.params.id;
      const result = await exportsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      await productsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount > 0) {
        res.send({ success: true, message: "Product deleted successfully" });
      } else {
        res.status(404).send({ success: false, message: "Product not found" });
      }
    });

    // UPDATE - exported product details info by modal and id
    app.put("/exports/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedProductInfo = req.body;

        await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedProductInfo }
        );
        const result = await exportsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedProductInfo }
        );

        if (result.modifiedCount > 0) {
          res.send({
            success: true,
            message: "Product updated successfully",
          });
        } else {
          res.status(404).send({
            success: false,
            message: "Product not found or no change",
          });
        }
      } catch (error) {
        // console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// app.get('/', (req, res) => {
//   res.send('Hello World!');
// });

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
