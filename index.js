const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

dotenv.config()


const uri = process.env.MONGODB_URI;
const app = express()


const PORT = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const JWKS = createRemoteJWKSet(
    new URL("http://localhost:3000/api/auth/jwks")
)

const verifyToken = async (req, res, next) => {
    const authHeader = req?.headers.authorization
    if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" })
    }
    const token = authHeader.split(" ")[1]
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    try {
        const { payload } = await jwtVerify(token, JWKS)
        console.log(payload)
        next()
    } catch (error) {
        return res.status(403).json({ message: "Forbidden" })
    }

}


async function run() {

    try {

        // Connect the client to the server	(optional starting in v4.7)

        await client.connect();

        const db = client.db("studynook")
        const roomCollection = db.collection("rooms")
        const bookingCollection = db.collection("bookings")



        // Get API for getting all Rooms

        app.get('/room', async (req, res) => {
            const result = await roomCollection.find().toArray()
            res.json(result)
        })


        // Post API for Adding New Room
        // Middleware

        app.post('/room', verifyToken, async (req, res) => {
            const roomData = req.body
            console.log(roomData)
            const result = await roomCollection.insertOne(roomData)

            res.json(result)

        })

        // Get API for Room Details
        // Middleware

        app.get('/room/:id', verifyToken, async (req, res) => {
            const { id } = req.params

            const result = await roomCollection.findOne({ _id: new ObjectId(id) })

            res.json(result)

        })

        // Patch API for updating Room Details
        // Middleware

        app.patch('/room/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const updatedData = req.body

            const result = await roomCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedData }
            )

            res.json(result)
        })

        // Delete API for deleting Room Details
        // Middleware

        app.delete('/room/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const result = await roomCollection.deleteOne({ _id: new ObjectId(id) })
            res.json(result)

        })


        // Post API for bookings room
        // Middleware

        app.post('/booking', verifyToken, async (req, res) => {

            const bookingData = req.body

            const bookingDate = new Date(bookingData.date);

            const today = new Date();

            today.setHours(0, 0, 0, 0);

            bookingDate.setHours(0, 0, 0, 0);

            if (bookingDate < today) {
                return res.status(400).json({
                    success: false,
                    message: "You cannot book a room for a past date."
                });
            }

            const hourlyRate = 5;

            const startHour = Number(bookingData.startTime.split(":")[0]);
            const endHour = Number(bookingData.endTime.split(":")[0]);

            const duration = endHour - startHour;
            const totalCost = duration * hourlyRate;


            const conflict = await bookingCollection.findOne({
                roomId: bookingData.roomId,
                date: bookingData.date,
                status: "confirmed",
                startTime: bookingData.startTime,
                endTime: bookingData.endTime,
            });

            if (conflict) {
                return res.status(400).json({
                    success: false,
                    message: "This room is already booked."
                });
            }

            bookingData.status = "confirmed";

            bookingData.hourlyRate = hourlyRate;
            bookingData.duration = duration;
            bookingData.totalCost = totalCost;


            const result = await bookingCollection.insertOne(bookingData)

            res.json({
                success: true,
                message: "Room booked successfully!",
                result
            });
        })


        // Create Get My Bookings API

        app.get('/booking/:userId', async (req, res) => {
            const { userId } = req.params;

            const result = await bookingCollection
                .find({ userId })
                .toArray();

            res.json(result);
        });


        // Create Cancel Booking API from My Bookings Page
        // Middleware

        app.patch("/booking/:id/cancel", verifyToken, async (req, res) => {

            const { id } = req.params;

            const result = await bookingCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: "cancelled"
                    }
                }
            );

            res.json({
                success: true,
                message: "Booking cancelled",
                result
            });

        });





        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Congratulations! Your Server is running fine!")
})




app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)

})