const express = require('express');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('colors');

const connectDB = require('./config/db');
const User = require('./models/user');
const Friend = require('./models/friend');
const Message = require('./models/message');
const Conversation = require('./models/conversation');


const port = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const expressServer = http.createServer(app);
const io = new Server(expressServer, {
    cors: {
        origin: "*",
        credentials: true,
    }
})

connectDB();

const activeUsers = new Set();

const run = async () => {
    try {

        io.on("connection", function (socket) {

            socket.on('join', function (data) {
                // console.log(data);
                // io.emit('welcome', { mesage: `Welcome back ${data}` })
            });

            socket.on("new_user", function (email) {
                socket.userId = email;
                // const emailArr = [...activeUsers];
                activeUsers.add(email);

                io.emit("new_user", [...activeUsers]);
            });

            socket.on('leavedUser', email => {
                activeUsers.delete(email);
                io.emit("new_user", [...activeUsers]);
            });

            socket.on('room', room => {
                socket.join(room)
                socket.on('id', ({ peerId, videoCall, caller }) => {
                    socket.to(room).emit('id', ({ peerId, videoCall, caller }));
                })
                socket.on('callEnd', data => {
                    socket.to(room).emit('callEnd', data);
                })
                socket.on('callAnswered', data => {
                    socket.to(room).emit('callAnswered', data);
                })
                socket.on('videoActive', data => {
                    socket.to(room).emit('videoActive', data);
                })
                socket.on('users', data => {
                    io.to(room).emit('users', data);
                })
            });

            socket.on('typing', data => {
                console.log(data);
            })

            socket.on("disconnect", () => {
                activeUsers.delete(socket.userId);
                io.emit("new_user", [...activeUsers]);
            });


            // Send Friend Request
            app.post('/send-request', async (req, res) => {
                const { currentUser, requestedPerson, conversationId } = req.body;
                const friend = {
                    friendship: [currentUser.email, requestedPerson.email],
                    requester: currentUser.email,
                    receiver: requestedPerson.email,
                    users: [
                        currentUser.id, requestedPerson.id
                    ],
                    status: 'pending',
                    timestamp: new Date().getTime(),
                    conversationId
                }
                const friends = await Friend.where('friendship').in(currentUser.email);
                const isExist = friends.find(f => f.friendship.includes(currentUser.email) && f.friendship.includes(requestedPerson.email));
                if (isExist) {
                    res.send({ message: 'Already Added' });
                }
                else {
                    try {
                        const newFriend = await Friend.create(friend);
                        io.emit('newFriendReq', newFriend);
                        res.send(newFriend);
                    }
                    catch (e) {
                        res.send({ message: 'Internal server error in /send-request' })
                    }
                }
            });

            // Add conversation
            app.post('/conversations', async (req, res) => {
                try {
                    const conversation = req.body;
                    const newConversation = await Conversation.create(conversation);
                    res.send(newConversation);
                }
                catch (err) {
                    res.send({ message: 'Internal server error add conversations' })
                }
            });

            // Update conversation status
            app.put('/conversation-status/:id', async (req, res) => {
                const { id } = req.params;
                const updatedDoc = {
                    isFriend: true,
                    timestamp: new Date().getTime()
                }
                try {
                    const updatedConversation = await Conversation.findByIdAndUpdate(id, updatedDoc, { new: true }).populate('users');
                    io.emit("conversation", updatedConversation);
                    res.send(updatedConversation);
                }
                catch (e) {
                    res.send({ message: 'Internal server error in Update conversation status' })
                }
            });


            // Update conversation last message
            app.put('/conversations/:id', async (req, res) => {
                const { id } = req.params;
                const data = req.body;
                const updatedDoc = {
                    lastMessage: data.messageText,
                    sender: data.email,
                    timestamp: data.timestamp,
                    img: data.img,
                    unseenMessages: data.unseenMessages + 1,
                    sent: {
                        messageSent: true,
                        timestamp: new Date().getTime()
                    }
                }
                try {
                    const updatedConversation = await Conversation.findByIdAndUpdate(id, updatedDoc, { new: true });
                    io.emit("updateConversation", ({ data: updatedConversation, id }));
                    // console.log(updatedConversation);
                    res.send(updatedConversation);
                }
                catch (err) {
                    res.send({ message: 'Internal server error in Update conversation last message' });
                }
            });


            // Update conversation last seen
            app.put('/last-seen/:id', async (req, res) => {
                const { id } = req.params;
                const data = req.body;
                const updatedDoc = {
                    lastSeen: {
                        message: data.message,
                        timestamp: data.timestamp,
                        whoSeen: data.email
                    }
                }
                try {
                    const updatedConversation = await Conversation.findByIdAndUpdate(id, updatedDoc, { new: true });
                    io.emit("lastSeen", ({ data: updatedConversation, id }));
                    res.send(updatedConversation)
                }
                catch (e) {
                    res.send({ message: 'Internal server error in Update conversation last seen' });
                }
            });

            // Send Message
            app.post('/send-message', async (req, res) => {
                try {
                    const message = req.body;
                    const sendMessage = await Message.create(message);
                    io.emit("message", sendMessage);
                    res.send(sendMessage);
                }
                catch (err) {
                    res.send({ message: 'Internal server error in send-message' });
                }
            });

            // Accept friend request
            app.put('/accept/:id', async (req, res) => {
                const { id } = req.params;
                const updateDoc = { status: 'friend' }
                const unsetProperty = { requester: '', receiver: '', timestamp: '' }
                const acceptedFriend = await Friend.findByIdAndUpdate(id, { ...updateDoc, $unset: unsetProperty }, { new: true }).populate('users');
                //io.emit('req-accepted', acceptedFriend);
                res.send(acceptedFriend);
            });

            // Handle message Notification
            socket.on('message-notification', async ({ id, data }) => {
                const updatedDoc = {
                    unseenMessages: 0,
                    lastSeen: {
                        message: data.message,
                        timestamp: data.timestamp,
                        whoSeen: data.email
                    }
                }
                const result = await Conversation.findByIdAndUpdate(id, { ...updatedDoc }, { new: true });
                io.emit('message-notification-update', { result, id });
                io.emit('lastSeen', { id, data: result });
            });

            // Message delivered
            socket.on('delivering', ({ id }) => {
                socket.emit('delivering', id);
            })

            socket.on('delivered', async (id) => {
                const deliveredMessage = await Conversation.findByIdAndUpdate(id, {
                    sent: {
                        messageSent: true,
                        timestamp: new Date().getTime()
                    },
                    delivered: {
                        messageDelivered: true,
                        timestamp: new Date().getTime()
                    }
                }, { new: true })
                io.emit('delivered', deliveredMessage);
            })

            // Delete a message
            app.delete('/delete-message/:id', async (req, res) => {
                const { id } = req.params;
                try {
                    const deletedMessage = await Message.findByIdAndRemove(id);
                    io.emit('delete-message', deletedMessage);
                    res.send(deletedMessage);
                }
                catch (e) {
                    console.log('Delete message api', e.message);
                }
            })
        });


        app.get('/new-people', async (req, res) => {
            try {
                const friendsEmail = (await Friend.where('friendship').in(req.query.email)).map(user => user.friendship.filter(email => email !== req.query.email)[0]);
                const user = await User.where('email').nin([...friendsEmail, req.query.email]).limit(7);
                res.send(user)
            }
            catch (e) {
                res.send(e.message);
            }
        })


        app.get('/find-people', async (req, res) => {
            try {
                const friendsEmail = (await Friend.where('friendship').in(req.query.email)).map(user => user.friendship.filter(email => email !== req.query.email)[0]);
                const user = await User.where('email').nin([...friendsEmail, req.query.email])
                res.send(user)
            }
            catch (e) {
                res.send(e.message);
            }
        })

        // Add user api
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await User.create(user);
            res.send(result);
        });

        // Get single user by email
        app.get('/user', async (req, res) => {
            try {
                const user = await User.findOne({ email: req.query.email });
                res.send(user)
            }
            catch (e) {
                res.send(e.message);
            }
        })

        // Get single user by username
        app.get('/profile', async (req, res) => {
            try {
                const user = await User.findOne({ username: req.query.username });
                res.send(user)
            }
            catch (e) {
                res.send(e.message);
            }
        });

        // Update profile
        app.post('/update-profile/:id', async (req, res) => {
            const { id } = req.params;
            try {
                const profileUpdated = await User.findByIdAndUpdate(id, req.body, { new: true });
                res.send(profileUpdated);
            }
            catch (err) {

            }
        })

        // Update profile Photo
        app.post('/update-profile-photo/:id', async (req, res) => {
            const { id } = req.params;
            try {
                const profileUpdated = await User.findByIdAndUpdate(id, req.body, { new: true });
                res.send(profileUpdated);
            }
            catch (err) {
                throw new Error(err);
            }
        });

        // Update Cover Photo
        app.post('/update-cover-photo/:id', async (req, res) => {
            const { id } = req.params;
            try {
                const profileUpdated = await User.findByIdAndUpdate(id, { coverImg: req.body.img }, { upsert: true, new: true });
                res.send(profileUpdated);
            }
            catch (err) {
                throw new Error(err);
            }
        });

        // Get friend requests
        app.get('/friend-request', async (req, res) => {
            const { email } = req.query;
            const friendRequests = await Friend.where('receiver').equals(email).where('status').equals('pending').populate('users').sort({ timestamp: -1 });
            res.send(friendRequests);
        });

        //  Get all requested friends
        app.get('/requested-friends', async (req, res) => {
            const { email } = req.query;
            const friends = await Friend.find();
            const result = friends.filter(friend => friend.friendship.includes(email)).filter(f => f.status === 'pending');
            res.send(result);
        })

        // Cancel Friend friend Request
        app.delete('/cancel/:id', async (req, res) => {
            const { id } = req.params;
            const cancelFriend = await Friend.findByIdAndRemove(id);
            res.send(cancelFriend);
        })


        // Get all friends
        app.get('/friends', async (req, res) => {
            const { email } = req.query;
            // console.log(email);
            const filter = { friendship: email, status: 'friend' }
            const friends = await Friend.find(filter).populate('users');
            res.send(friends)
        });


        // Get conversations
        app.get('/conversations', async (req, res) => {
            const { email } = req.query;
            try {
                const conversations = await Conversation.where('participants').in(email).where('isFriend').equals(true).populate('users').sort({ timestamp: -1 });
                res.send(conversations);
            }
            catch (e) { console.log(e.message) }
        });


        // Get Searched Conversations
        app.get('/search-conversations', async (req, res) => {
            const { search, email } = req.query;
            try {
                const conversations = await Conversation.where('participants').in(email).where('isFriend').equals(true).populate('users').sort({ timestamp: -1 });
                const result = conversations.filter(conversation => conversation.users.find(user => user.email !== email).name.toLowerCase().includes(search.toLocaleLowerCase()));
                res.send(result);
            }
            catch (e) {
                console.log(e.message);
            }
        });


        // Get single conversation by id
        app.get('/conversation/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const conversation = await Conversation.findById(id).populate('users');
                res.send(conversation);
            }
            catch (e) {
                console.log("Get single conversation by id", e.message);
            }
        });

        // Get Messages
        app.get('/messages', async (req, res) => {
            try {
                const { conversationId } = req.query;
                const isExist = await Conversation.findById(conversationId);
                if (isExist == null) {
                    res.send({ message: "Not Found", code: 404 });
                    return;
                };
                const messages = await Message.where("conversationId").equals(conversationId).sort({ timestamp: -1 })
                res.send(messages);
            }
            catch (err) {
                res.send(err);
            }
        });
    }
    catch (e) {

    }
    finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from Squeep server!');
});

expressServer.listen(port, () => console.log('Server running at port ' + port));