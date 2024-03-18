const express = require('express');
require('dotenv').config()
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
// const stripe = require("stripe")(process.env.SPRITE_SECRET_KEY);

app.use(express.json());
app.use(cors());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ojnnavp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
  
    const apartmentCollection = client.db('ApartmentHubDB').collection('apartment');

    const usersCollection = client.db('ApartmentHubDB').collection('users');

    const agreementAcceptCollection = client.db('ApartmentHubDB').collection('agreementAccept');

    const cartApartmentCollection = client.db('ApartmentHubDB').collection('cartApartment');

    const couponsCollection = client.db('ApartmentHubDB').collection('coupons');

    const paymentCollection = client.db('ApartmentHubDB').collection('payment');
    
    const announcementCollection = client.db('ApartmentHubDB').collection('announcement');



// jwt 

  app.post('/jwt', async(req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.SECRET_TOKEN, {expiresIn: '365d'});
        res.send({ token });
  })

  const verifyToken = (req, res, next) => {
         if(!req.headers.authorization){
             return res.status(401).send({message: 'forbidden access'}) 
         }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.SECRET_TOKEN , (err , decoded) => {
           if(err){
            return res.status(401).send({message: 'forbidden access'}) 
           }
           req.decoded = decoded;
           next();
      })
      
  }



  // user collection here;
  //  public api 

  app.post('/user', async(req, res) => {
      const userInfo = req.body;
      const query = {email: userInfo.email};
      const existingUser = await usersCollection.findOne(query);
      if(existingUser){
         return res.send({message: 'user already existing'})
      };
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
  })

// public api
   app.get('/apartment', async(req, res) => {
        const page =  parseInt(req.query.page);
        const size =  parseInt(req.query.size);
        const result = await apartmentCollection.find().skip(page * size).limit(size).toArray();
        res.send(result);
   })
// public api

   app.get('/apartment-count', async(req, res) => {
        const result = await apartmentCollection.estimatedDocumentCount();
        res.send({result});
   })

   app.post('/apartment',verifyToken, async(req, res) => {
       const apartmentData = req.body;
       const result = await cartApartmentCollection.insertOne(apartmentData);
       res.send(result);

   })

   app.get('/cart-apartment', verifyToken, async(req, res) => {

         const result = await cartApartmentCollection.find().toArray();
         res.send(result)

   })

   app.patch('/update-reject/:id', verifyToken, async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const updateDoc = {
          $set:{ status: 'checked'}
        }
        const result = await cartApartmentCollection.updateOne(query,updateDoc);
        res.send(result); 
   })

   app.post('/update-confirm',verifyToken, async(req, res) => {
         const {roomData} = req.body;
         const statusQuery = {_id: new ObjectId(roomData._id)};
         const updateDocStatus = {
             $set: { status: 'checked'}
         }

        const resultStatus = await cartApartmentCollection.updateOne(statusQuery,updateDocStatus);

        const userQuery = {email: roomData.userEmail};
        const updateRole = {
            $set: { role: 'member'}
        };

        const resultRole = await usersCollection.updateOne(userQuery, updateRole);

        delete roomData._id;
        const result = await agreementAcceptCollection.insertOne(roomData);
      
        res.send({resultStatus, resultRole, result})
   })

   app.get('/user-role/:email', verifyToken, async(req, res) => {
         const email = req.params.email;
         const query = {email: email};
         const result = await usersCollection.findOne(query);
         res.send(result); 
   })

   app.get('/member-data/:email',verifyToken, async(req, res) => {
          const email = req.params.email;
          const query = {userEmail: email};
          console.log(query);
          const result = await agreementAcceptCollection.find(query).toArray();
          res.send(result);
   })

  //  coupon adding

  app.post('/coupon-add', verifyToken, async(req, res) => {
       const {couponData} = req.body;
       const result = await couponsCollection.insertOne(couponData);
       res.send(result);  
  })

  app.get('/all-coupons', verifyToken, async(req, res) => {
        const result = await couponsCollection.find().toArray();
        res.send(result)
  })

  //public api

  app.get('/coupons-available', async(req, res) => {
       const query = {available: 'yes'};
       const result = await couponsCollection.find(query).toArray()
       res.send(result);
  })

  app.patch('/coupon/:id', verifyToken, async(req, res) => {
         const id = req.params.id;
         const query = {_id: new ObjectId(id)};
         const updateDoc = {
             $set: { available: 'no' }
         };

         const result = await couponsCollection.updateOne(query,updateDoc);
         res.send(result)
  })

  //  stripe function 

  app.post('/create-payment-intent', verifyToken, async( req, res) => {
       let {price} = req.body;
       if(price == 0){
            price = 2
         }
       const amount = parseInt(price * 100);
       const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card'],
  });

     res.send({
          clientSecret: paymentIntent.client_secret
     })
        

  });


  app.post('/payment', verifyToken, async(req, res) => {
        const paymentInfo = req.body;
        const result = await paymentCollection.insertOne(paymentInfo);
        res.send(result)
  });


  app.get('/all-payment/:email', verifyToken, async(req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await paymentCollection.find(query).toArray()    
      res.send(result)
  })


  app.get('/all-member', verifyToken, async(req, res) => {
       const query = {role: 'member'};
       const result = await usersCollection.find(query).toArray();
       res.send(result)
  })

  app.patch('/remove-member/:id', verifyToken, async(req, res) => {
       const id = req.params.id;
       const query = {_id: new ObjectId(id) };
       const updateDoc = {
             $set: { role: 'user' }
       }
       
       const result = await usersCollection.updateOne(query,updateDoc);
       res.send(result)
  })


  app.post('/announcement', verifyToken, async(req, res) => {
         const announcement = req.body;
         const result = await announcementCollection.insertOne(announcement);
         res.send(result)
  })

  app.get('/announcement', verifyToken, async(req, res) => {
         const result = await announcementCollection.find().toArray();
         res.send(result)
  })


  // admin profile data

  app.get('/admin-profile-data', verifyToken, async(req, res) => {
      
          const allRooms = await apartmentCollection.estimatedDocumentCount();
          const rentedRooms = await agreementAcceptCollection.estimatedDocumentCount();
          const allUser = await usersCollection.find({role: 'user'}).toArray();
          const allMember = await usersCollection.find({ role: 'member'}).toArray();

          res.send({members:allMember.length,allRooms,users:allUser.length,rentedRooms});
  })

    
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
     res.send('Apratment Hub is running on server');
})

app.listen(port, ()=> {
    console.log(`Apratment Hub is running on port ${port}`);
})