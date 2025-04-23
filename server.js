const express = require('express');
const app = express();
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const fs = require('fs');

// Secret ID for session
const secret_id = process.env.secret;

// Salt for hashing
const saltRounds = 10;

// IP and port
const IP = 'localhost';
const port = process.env.PORT || 8080;

// View engine
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');

// Body-parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Express session Middleware
// app.use(session({
//     secret: secret_id,
//     saveUninitialized: true,
//     resave: true
// }));

// MySQL Connection
const connection = mysql.createConnection({
    host: 'localhost',
    port: 3306, // Replace with your MySQL port if different
    user: 'root',
    password: 'root',
    database: 'authentifi'
});

connection.connect(function(err) {
    if (!err) {
        console.log('Connected to MySql!\n');
    } else {
        console.log('Not connected to MySql.\n');
    }
});

// Web3 connection
const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));

// ABI and Contract Address
const abiArray = JSON.parse(fs.readFileSync('./contracts/authentifi_abi.json', 'utf8')); // Save ABI as a JSON file
const contractAddress = "YOUR_DEPLOYED_CONTRACT_ADDRESS"; // Replace with the deployed contract address
const contract = web3.eth.contract(abiArray).at(contractAddress);

// This function generates a QR code
function generateQRCode() {
    return crypto.randomBytes(20).toString('hex');
}

// Hash password using bcrypt
function hashBcrypt(password) {
    return bcrypt.hashSync(password, saltRounds);
}

// Hash email using md5
function hashMD5(email) {
    return crypto.createHash('md5').update(email).digest('hex');
}

// Routes for webpages
app.use(express.static(__dirname + '/views'));
app.use(express.static(__dirname + '/views/davidshimjs-qrcodejs-04f46c6'));

// Manufacturer generates a QR Code here
app.get('/createCodes', (req, res) => {
    res.sendFile('views/createCodes.html', { root: __dirname });
});

// Creating a new retailer
app.get('/createRetailer', (req, res) => {
    res.sendFile('views/createRetailer.html', { root: __dirname });
});

// Serve the sign-up form
app.get('/signUpForm', (req, res) => {
    res.sendFile('views/signUp.html', { root: __dirname });
});

// Serve the login form
app.get('/loginForm', (req, res) => {
    res.sendFile('views/login.html', { root: __dirname });
});

// Serve the retailer login form
app.get('/retailerLoginForm', (req, res) => {
    res.sendFile('views/retailerLogin.html', { root: __dirname });
});

// Serve the customer details form
app.get('/getCustomerDetailsForm', (req, res) => {
    res.sendFile('views/getCustomerDetails.html', { root: __dirname });
});

// Serve the retailer details page
app.get('/retailerDetailsForm', (req, res) => {
    res.sendFile('views/retailerDetails.html', { root: __dirname });
});

// Serve the add retailer to code form
app.get('/addRetailerToCodeForm', (req, res) => {
    res.sendFile('views/addRetailerToCode.html', { root: __dirname });
});

// Serve the my assets form
app.get('/myAssetsForm', (req, res) => {
    res.sendFile('views/myAssets.html', { root: __dirname });
});

// Serve the get product details form
app.get('/getProductDetailsForm', (req, res) => {
    res.sendFile('views/getProductDetails.html', { root: __dirname });
});

// Serve the seller confirm form
app.get('/sellerConfirmForm', (req, res) => {
    res.sendFile('views/sellerConfirm.html', { root: __dirname });
});

// Serve the buyer confirm form
app.get('/buyerConfirmForm', (req, res) => {
    res.sendFile('views/buyerConfirm.html', { root: __dirname });
});

// Serve the scan form
app.get('/scanForm', (req, res) => {
    res.sendFile('views/scan.html', { root: __dirname });
});

// Main website which has 2 routers - manufacturer & retailer
app.get('/', (req, res) => {
    res.sendFile('views/index.html', { root: __dirname });
});


/**
 * Description: Adds a user to the database and to the blockchain
 * Request:     POST /signUp
 * Send:        JSON object which contains name, email, password, phone
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/signUp', (req, res) => {
    console.log('Request to /signUp\n');
    const { name, email, password, phone } = req.body;
    const hashedPassword = hashBcrypt(password);
    const hashedEmail = hashMD5(email);

    connection.query('SELECT * FROM USER WHERE Email = ? LIMIT 1', [email], (error, results) => {
        if (error) {
            console.error('MySQL error:', error);
            return res.status(400).send('Database error');
        }
        if (results.length) {
            return res.status(400).send('Email already exists!');
        }
        connection.query('INSERT INTO USER VALUES (?,?,?,?)', [name, email, hashedPassword, phone], (error) => {
            if (error) {
                console.error('MySQL error:', error);
                return res.status(400).send('Database error');
            }
            createCustomer(hashedEmail, name, phone, (err, result) => {
                if (err) {
                    console.error('Blockchain error:', err);
                    return res.status(400).send('Blockchain error');
                }
                console.log(`User ${hashedEmail} successfully added to Blockchain!`);
                res.status(200).send('Signup successful!');
            });
        });
    });
});

// Add the user in Blockchain
function createCustomer(hashedEmail, name, phone, callback) {
    contract.createCustomer(hashedEmail, name, phone, { from: web3.eth.defaultAccount, gas: 3000000 }, callback);
}


/**
 * Description: Login the user to the app
 * Request:     POST /login
 * Send:        JSON object which contains email, password
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/login', (req, res) => {
    console.log('Request to /login\n');
    const email = req.body.email;
    const password = req.body.password;
    console.log(`Email: ${email} \n`);

    connection.query('SELECT * FROM USER WHERE Email = ? LIMIT 1', [email], (error, results) => {
        if (error) {
            console.error('MySQL error:', error);
            return res.status(400).send('Database error');
        }
        if (results.length) {
            const hashedPassword = results[0].Password;
            if (bcrypt.compareSync(password, hashedPassword)) {
                console.log(`Login successful with ${email} \n`);
                return res.status(200).send('Login successful!');
            } else {
                console.log('Incorrect password\n');
                return res.status(400).send('Login failed. Incorrect password.');
            }
        }
        console.log('Email does not exist!\n');
        return res.status(400).send('Email does not exist!');
    });
});


/**
 * Description: Adds a retailer to the database and to the blockchain
 * Request:     POST /retailerSignUp
 * Send:        JSON object which contains name, email, password, location
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/retailerSignup', (req, res) => {
    console.log('Request to /retailerSignup\n');
    let retailerEmail = req.body.email;
    let retailerName = req.body.name;
    let retailerLocation = req.body.location;
    let retailerPassword = req.body.password;
    let retailerHashedPassword = hashBcrypt(retailerPassword);
    let retailerHashedEmail = hashMD5(retailerEmail);
    console.log(`retailerEmail: ${retailerEmail}, hashedEmail: ${retailerHashedEmail} \n`);

    connection.query('SELECT * FROM RETAILER WHERE retailerEmail = ? LIMIT 1', [retailerEmail], (error, results) => {
        if (error) {
            console.error('MySQL error:', error);
            return res.status(400).send('Some SQL Error');
        }
        if (results.length) {
            return res.status(400).send('Email already exists!');
        }
        connection.query('INSERT INTO RETAILER VALUES (?,?,?,?)', [retailerName, retailerEmail, retailerLocation, retailerHashedPassword], (error) => {
            if (error) {
                console.error('MySQL error:', error);
                return res.status(400).send('Some SQL Error');
            }
            createRetailer(retailerHashedEmail, retailerName, retailerLocation, (err) => {
                if (err) {
                    console.error('Blockchain error:', err);
                    return res.status(400).send('Blockchain error');
                }
                console.log(`Retailer ${retailerHashedEmail} successfully added to Blockchain!\n`);
                return res.status(200).send('Retailer successfully added');
            });
        });
    });
});


// Add retailer to Blockchain
function createRetailer(retailerHashedEmail, retailerName, retailerLocation, callback) {
    contract.createRetailer(retailerHashedEmail, retailerName, retailerLocation, { from: web3.eth.defaultAccount, gas: 3000000 }, callback);
}


/**
 * Description: Login the retailer to the app
 * Request:     POST /retailerLogin
 * Send:        JSON object which contains email, password
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/retailerLogin', (req, res) => {
    console.log('Request to /retailerLogin\n');
    let retailerEmail = req.body.email;
    let retailerPassword = req.body.password;
    console.log(`Email: ${retailerEmail} \n`);

    connection.query('SELECT retailerHashedPassword FROM RETAILER WHERE retailerEmail = ?', [retailerEmail], (error, results) => {
        if (error) {
            console.error('MySQL error:', error);
            return res.status(400).send('Database error');
        }
        if (results.length) {
            let pass = results[0].retailerHashedPassword;
            if (bcrypt.compareSync(retailerPassword, pass)) {
                console.log(`${retailerEmail} has successfully logged in\n`);
                return res.status(200).send('Retailer login successful!');
            }
        }
        console.log(`${retailerEmail} COULD NOT login\n`);
        return res.status(400).send('Retailer login failed.');
    });
});


/**
 * Description: Get reatiler details
 * Request:     GET /retailerDetails
 * Send:
 * Receive:     JSON object of retailer details if successful, 400 otherwise
 */
app.get('/retailerDetails', (req, res) => {
    connection.query('Select * from RETAILER', (error, results) => {
        if(error) {
            callback(error);
            return res.status(400).send('ERROR');
        }
        console.log(`Retailer details are:\n ${results} \n`);
        return res.status(400).send(JSON.parse(JSON.stringify(results)));
    })
});


/**
 * Description: Add retailer to code
 * Request:     POST /addRetailerToCode
 * Send:        JSON object which contains code, email
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/addRetailerToCode', (req, res) => {
    console.log('Request to /addRetailerToCode\n');
    let code = req.body.code;
    let retailerEmail = req.body.email;
    let hashedEmail = hashMD5(retailerEmail);
    console.log(`retailerEmail: ${retailerEmail}, hashed email: ${hashedEmail} \n`);
    contract.addRetailerToCode(code, hashedEmail, { from: web3.eth.defaultAccount, gas: 3000000 }, (err, result) => {
        if (err) {
            console.error('Blockchain error:', err);
            return res.status(400).send('Error');
        }
        console.log(`Successfully added ${hashedEmail} to code ${code} \n`);
        return res.status(200).send('Success');
    });
});


/**
 * Description: Lists all the assets owned by the user
 * Request:     POST /myAssets
 * Send:        JSON object which contains email
 * Receive:     JSON array of objects which contain brand, model, description, status, manufacturerName,manufacturerLocation,
 *                                                  manufacturerTimestamp, retailerName, retailerLocation, retailerTimestamp
 */
app.post('/myAssets', (req, res) => {
    console.log('Request to /myAssets\n');
    let myAssetsArray = [];
    let email = req.body.email;
    let hashedEmail = hashMD5(email);
    contract.getCodes(hashedEmail, (err, arrayOfCodes) => {
        if (err) {
            console.error('Blockchain error:', err);
            return res.status(400).send('Error');
        }
        console.log(`Email ${email}`);
        console.log(`Customer has these product codes: ${arrayOfCodes} \n`);
        arrayOfCodes.forEach((code) => {
            contract.getOwnedCodeDetails(code, (err, ownedCodeDetails) => {
                if (err) {
                    console.error('Blockchain error:', err);
                    return res.status(400).send('Error');
                }
                contract.getNotOwnedCodeDetails(code, (err, notOwnedCodeDetails) => {
                    if (err) {
                        console.error('Blockchain error:', err);
                        return res.status(400).send('Error');
                    }
                    myAssetsArray.push({
                        'code': code, 'brand': notOwnedCodeDetails[0],
                        'model': notOwnedCodeDetails[1], 'description': notOwnedCodeDetails[2],
                        'status': notOwnedCodeDetails[3], 'manufacturerName': notOwnedCodeDetails[4],
                        'manufacturerLocation': notOwnedCodeDetails[5], 'manufacturerTimestamp': notOwnedCodeDetails[6],
                        'retailerName': ownedCodeDetails[0], 'retailerLocation': ownedCodeDetails[1],
                        'retailerTimestamp': ownedCodeDetails[2]
                    });
                    if (myAssetsArray.length === arrayOfCodes.length) {
                        res.status(200).send(JSON.parse(JSON.stringify(myAssetsArray)));
                    }
                });
            });
        });
    });
});


/**
 * Description: Lists all the assets owned by the user
 * Request:     POST /stolen
 * Send:        JSON object which contains code, email
 * Receive:     200 if product status was changed, 400 otherwise.
 */
app.post('/stolen', (req, res) => {
    console.log('Request to /stolen\n');
    let code = req.body.code;
    let email = req.body.email;
    let hashedEmail = hashMD5(email);
    console.log(`Email: ${email} \n`);
    contract.reportStolen(code, hashedEmail, { from: web3.eth.defaultAccount, gas: 3000000 }, (err, result) => {
        if (err) {
            console.error('Blockchain error:', err);
            console.log(`ERROR! Code: ${code} status could not be changed.\n`);
            return res.status(400).send('ERROR! Product status could not be changed.');
        }
        console.log(`Product code ${code} successfully changed!\n`);
        res.status(200).send('Product status successfully changed!');
    });
});


// This array keeps track of all the QR Codes in use
const QRCodes = [];

/**
 * Description: Sell a product from myAssets (aka your inventory)
 * Request:     POST /sell
 * Send:        JSON object which contains code, sellerEmail
 * Receive:     List of QR Codes owned by the seller if successful, 400 otherwise
 */
app.post('/sell', (req, res) => {
    console.log('Request to /sell\n');
    let code = req.body.code;
    let sellerEmail = req.body.email;
    console.log(`Email ${sellerEmail} \n`);
    hashedSellerEmail = hashMD5(sellerEmail);
    let currentTime = Date.now();         // Date.now() gets the current time in milliseconds
    let QRCode = generateQRCode();
    let QRCodeObj = {
        'QRCode': QRCode, 'currentTime': currentTime, 'sellerEmail': sellerEmail, 'buyerEmail': '',
        'code': code, 'confirm': '0', 'retailer': '0'
    };
    QRCodes.push(QRCodeObj);
    console.log(`Session created ${(JSON.stringify(QRCode))} \n`);
    res.status(200).send(JSON.parse(JSON.stringify(QRCode)));
});


/**
 * Description: Buy a product
 * Request:     POST /buy
 * Send:        JSON object which contains QRCode, email
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/buy', (req, res) => {
    console.log('Request to /buy\n');
    let QRCode = req.body.QRCode;
    let buyerEmail = req.body.email;
    let currentTime = Date.now();         // Date.now() gets the current time in milliseconds
    console.log(`Email: ${buyerEmail} \n`);
    for (let i = 0; i < QRCodes.length; i++) {
        if (QRCode === QRCodes[i]['QRCode']) {
            let timeElapsed = Math.floor((currentTime - QRCodes[i]['currentTime']) / 1000);
            // QR Codes are valid only for 600 secs
            if (timeElapsed <= 600) {
                QRCodes[i]['buyerEmail'] = buyerEmail;
                console.log(`QRCode matches, Session updated ${(JSON.stringify(QRCode))} \n`);
                return res.status(200).send('Validated!');
            }
            console.log('Time out error\n');
            return res.status(400).send('Timed out!');
        }
    }
    console.log('Could not find QRCode\n');
    return res.status(400).send('Could not find QRCode');
});


/**
 * Description: Get product details
 * Request:     POST /getProductDetails
 * Send:        JSON object which contains code
 * Receive:     JSON object whcih contains brand, model, description, status, manufacturerName, manufacturerLocation,
 *                                         manufacturerTimestamp, retailerName, retailerLocation, retailerTimestamp
 */
app.post('/getProductDetails', (req, res) => {
    console.log('Request to /getProductDetails\n');
    let code = req.body.code;
    let QRCode = req.body.QRCode;
    let currentTime = Date.now();         // Date.now() gets the current time in milliseconds
    for (let i = 0; i < QRCodes.length; i++) {
        if (QRCode === QRCodes[i]['QRCode']) {
            let timeElapsed = Math.floor((currentTime - QRCodes[i]['currentTime']) / 1000);
            // QR Codes are valid only for 600 secs
            if (timeElapsed <= 600) {
                contract.getOwnedCodeDetails(code, (err, ownedCodeDetails) => {
                    if (err) {
                        console.error('Blockchain error:', err);
                        return res.status(400).send('Could not retrieve product details.');
                    }
                    contract.getNotOwnedCodeDetails(code, (err, notOwnedCodeDetails) => {
                        if (err) {
                            console.error('Blockchain error:', err);
                            return res.status(400).send('Could not retrieve product details.');
                        }
                        let productDetails = {
                            'brand': notOwnedCodeDetails[0], 'model': notOwnedCodeDetails[1], 'description': notOwnedCodeDetails[2],
                            'status': notOwnedCodeDetails[3], 'manufacturerName': notOwnedCodeDetails[4],
                            'manufacturerLocation': notOwnedCodeDetails[5], 'manufacturerTimestamp': notOwnedCodeDetails[6],
                            'retailerName': ownedCodeDetails[0], 'retailerLocation': ownedCodeDetails[1],
                            'retailerTimestamp': ownedCodeDetails[2]
                        };
                        console.log('QRCode matched\n');
                        return res.status(200).send(JSON.parse(JSON.stringify(productDetails)));
                    });
                });
            }
            console.log('Time out error\n');
            return res.status(400).send('Timed out!');
        }
    }
});


/**
 * Description: Seller confirms deal and gets registered as new owner on the Blockchain
 * Request:     POST /sellerConfirm
 * Send:        JSON object which contains email, QRCode, retailer
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/sellerConfirm', (req, res) => {
    console.log('Request to /sellerConfirm\n');
    let sellerEmail = req.body.email;
    let QRCode = req.body.QRCode;
    let retailer = req.body.retailer;
    console.log(`Email: ${sellerEmail} \n`);
    let currentTime = Date.now();         // Date.now() gets the current time in milliseconds
    let sellerHashedEmail = hashMD5(sellerEmail);
    for (let i = 0; i < QRCodes.length; i++) {
        if (QRCode === QRCodes[i]['QRCode']) {
            let timeElapsed = Math.floor((currentTime - QRCodes[i]['currentTime']) / 1000);
            // QR Codes are valid only for 600 secs
            if (timeElapsed <= 600) {
                QRCodes[i]['confirm'] = '1';
                if(retailer === '1') {
                    QRCodes[i]['retailer'] = '1';
                }
                console.log('Success in sellerConfirm\n');
                return res.status(200).send('Seller confirmed!');
            }
            console.log('Time out error\n');
            return res.status(400).send('Timed out!');
        }
    }
    console.log('Could not find QRCodes\n');
    return res.status(400).send('Could not find QRCodes');
});


/**
 * Description: Buyer confirms deal
 * Request:     POST /buyerConfirm
 * Send:        JSON object which contains email, QRCode
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/buyerConfirm', (req, res) => {
    console.log('Request made to /buyerConfirm\n');
    let buyerEmail = req.body.email;
    let QRCode = req.body.QRCode;
    let currentTime = Date.now();
    console.log(`Email: ${buyerEmail} and QRCode: ${QRCode} \n`);

    for (let i = 0; i < QRCodes.length; i++) {
        if (QRCode === QRCodes[i]['QRCode']) {
            let timeElapsed = Math.floor((currentTime - QRCodes[i]['currentTime']) / 1000);
            if (timeElapsed <= 600) {
                if (QRCodes[i]['confirm'] === '1') {
                    let hashedSellerEmail = hashMD5(QRCodes[i]['sellerEmail']);
                    let hashedBuyerEmail = hashMD5(QRCodes[i]['buyerEmail']);
                    let code = QRCodes[i]['code'];
                    if (QRCodes[i]['retailer'] === '1') {
                        console.log('Performing transaction for retailer\n');
                        contract.initialOwner(code, hashedSellerEmail, hashedBuyerEmail, { from: web3.eth.defaultAccount, gas: 3000000 }, (err) => {
                            if (err) {
                                console.error('Blockchain error:', err);
                                return res.status(400).send('Error');
                            }
                            console.log('Success in buyerConfirm, transaction is done!\n');
                            return res.status(200).send('Ok');
                        });
                    } else {
                        console.log('Performing transaction for customer\n');
                        contract.changeOwner(code, hashedSellerEmail, hashedBuyerEmail, { from: web3.eth.defaultAccount, gas: 3000000 }, (err) => {
                            if (err) {
                                console.error('Blockchain error:', err);
                                return res.status(400).send('Error');
                            }
                            console.log('Success in buyerConfirm, transaction is done!\n');
                            return res.status(200).send('Ok');
                        });
                    }
                    return; // Exit loop after processing
                }
                console.log('Buyer has not confirmed\n');
                return res.status(400).send('Buyer has not confirmed.');
            }
            console.log('Timed out!\n');
            return res.status(400).send('Timed out!');
        }
    }
    console.log('Product not found\n');
    return res.status(400).send('Product not found');
});

// Function that creates an initial owner for a product
function initialOwner(code, retailerHashedEmail, customerHashedEmail, callback) {
    contract.initialOwner(code, retailerHashedEmail, customerHashedEmail, { from: web3.eth.defaultAccount, gas: 3000000 }, callback);
}

// Function that creates transfers ownership of a product
function changeOwner(code, oldOwnerHashedEmail, newOwnerHashedEmail, callback) {
    contract.changeOwner(code, oldOwnerHashedEmail, newOwnerHashedEmail, { from: web3.eth.defaultAccount, gas: 3000000 }, callback);
}


/**
 * Description: Gives product details if the scannee is not the owner of the product
 * Request:     POST /scan
 * Send:        JSON object which contains code
 * Receive:     JSON object which has productDetails
 */
app.post('/scan', (req, res) => {
    console.log('Request made to /scan\n');
    const code = req.body.code;

    if (!code) {
        console.error('Invalid code provided');
        return res.status(400).send('Invalid code provided');
    }

    console.log(`Fetching details for code: ${code}`);

    contract.getNotOwnedCodeDetails(code, (err, productDetails) => {
        if (err) {
            console.error('Blockchain error:', err);
            return res.status(400).send('Error retrieving product details from the blockchain.');
        }

        if (!productDetails || productDetails.length === 0 || productDetails[0] === '') {
            console.error('Invalid or empty product details returned from the blockchain');
            return res.status(400).send('Product details not found or invalid.');
        }

        try {
            const productDetailsObj = {
                name: productDetails[0],
                model: productDetails[1],
                status: parseInt(productDetails[2], 10),
                description: productDetails[3],
                manufacturerName: productDetails[4],
                manufacturerLocation: productDetails[5],
                manufacturerTimestamp: productDetails[6],
            };

            console.log(`Code ${code} details retrieved successfully\n`);
            res.status(200).send(productDetailsObj);
        } catch (parseError) {
            console.error('Error parsing product details:', parseError);
            res.status(500).send('Error processing product details.');
        }
    });
});


/**
 * Description: Generates QR codes for the manufacturers
 * Request:     POST /QRCodeForManufacturer
 * Send:        JSON object which contains brand, model, status, description, manufacturerName, manufacturerLocation
 * Receive:     200 if QR code was generated, 400 otherwise.
 */
app.post('/QRCodeForManufacturer', (req, res) => {
    console.log('Request to /QRCodeForManufacturer\n');
    let brand = req.body.brand;
    let model = req.body.model;
    let status = 0;
    let description = req.body.description;
    let manufacturerName = req.body.manufacturerName;
    let manufacturerLocation = req.body.manufacturerLocation;
    let manufacturerTimestamp = new Date().toISOString().slice(0, 10);
    let salt = crypto.randomBytes(20).toString('hex');
    let code = hashMD5(brand + model + status + description + manufacturerName + manufacturerLocation + salt);

    contract.createCode(code, brand, model, status, description, manufacturerName, manufacturerLocation, manufacturerTimestamp, { from: web3.eth.defaultAccount, gas: 3000000 }, (err) => {
        if (err) {
            console.error('Blockchain error:', err);
            return res.status(400).send('ERROR! QR Code for manufacturer could not be generated.');
        }
        console.log(`Brand: ${brand} \n`);
        console.log(`The QR Code generated is: ${code} \n`);
        let QRcode = `${code}\n${brand}\n${model}\n${description}\n${manufacturerName}\n${manufacturerLocation}`;
        fs.writeFile('views/davidshimjs-qrcodejs-04f46c6/code.txt', QRcode, (err) => {
            if (err) {
                console.error('File write error:', err);
                return res.status(500).send('Error writing QR code to file.');
            }
            console.log('Successfully written QR code to file!\n');
            res.sendFile('views/davidshimjs-qrcodejs-04f46c6/index.html', { root: __dirname });
        });
    });
});


/**
 * Description: Gives all the customer details
 * Request:     GET /getCustomerDetails
 * Send:        JSON object which contains email
 * Receive:     JSON object which contains name, phone
 */
app.get('/getCustomerDetails', (req, res) => {
    console.log('Request to /getCustomerDetails\n');
    let email = req.body.email;
    let hashedEmail = hashMD5(email);

    contract.getCustomerDetails(hashedEmail, (err, customerDetails) => {
        if (err) {
            console.error('Blockchain error:', err);
            return res.status(400).send('Error retrieving customer details.');
        }
        if (!customerDetails || customerDetails.length < 2) {
            console.error('Invalid customer details returned from blockchain');
            return res.status(400).send('Customer details not found.');
        }
        let customerDetailsObj = {
            name: customerDetails[0],
            phone: customerDetails[1]
        };
        res.status(200).send(customerDetailsObj);
    });
});

// New route to get not owned code details
app.get('/getNotOwnedCodeDetails/:code', (req, res) => {
    const code = req.params.code;

    contract.getNotOwnedCodeDetails(code, (err, result) => {
        if (err) {
            console.error('Blockchain error:', err);
            return res.status(400).send('Error retrieving code details.');
        }
        console.log('Code details:', result);
        res.status(200).send(result);
    });
});

// Server start
app.listen(port, () => {
    console.log(`Listening to port ${port}...\n`);
});