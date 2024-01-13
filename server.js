const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const app = express()
const mongoose = require('mongoose')
const User = require('./model/user')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const Weather = require('./model/weather')


//const usersRoutes = require('./routes/users')
const JWT_SECRET = 'rowenrjwnernwkerwnejrkwnerkwernwrkjwe'
const apiKey = '3bf05d4fa780b9c7854a7389e20e6320'
const GEOCODING_API_KEY = 'AIzaSyBDwQYy9Qs0fgJTmyNwthC6Gjs-1Vz7A0M'

mongoose.connect('mongodb://127.0.0.1:27017/dbweatherapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("db connected")
});

app.use('/', express.static(path.join(__dirname, 'static')))
app.use(bodyParser.json())

app.post('/api/change-password', async (req, res) => {
    const { token, newpassword: plainTextPassword } = req.body


    if (!plainTextPassword || typeof plainTextPassword !== 'string') {
        return res.json({ status: 'error', error: 'Invalid password' })
    }

    if (plainTextPassword.length < 5) {
        return res.json({ status: 'error', error: 'Password too small. Should be atleast 6 characters' })
    }


    try {
        const user = jwt.verify(token, JWT_SECRET)
        console.log(user)
        const _id = user.id
        const password = await bcrypt.hash(plainTextPassword, 10)
        await User.updateOne({ _id }, {
            $set: { password }
        })
        res.json({ status: 'ok' })

    } catch (error) {
        res.json({ status: 'error', error: 'kljsandja' })
    }
    res.json({ status: 'ok' })
})

app.get('/allusers', async (req, res) => {
    try {
        const users = await User.find({}).lean()

        res.json(users)
    } catch (error) {
        console.log("Error retrieving data", error)
        res.status(500).json({ status: 'error', error: "Internal server error" })
    }
})

app.post('/api/login', async (req, res) => {

    const { username, password } = req.body
    const user = await User.findOne({ username }).lean()

    if (!user) {
        return res.json({ status: 'error', error: 'Invalid username/password' })
    }

    if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({
            id: user._id,
            username: user.username
        }, JWT_SECRET)
        return res.json({ status: 'ok', data: token })
    }
    res.json({ status: 'error', data: 'Invalid Username/password' })

})

/*app.delete('/:_id', async (req, res) => {
    const id = req.params
    try {
        const deletedUser = await User.findByIdAndRemove(id)
        if (!deletedUser) {
            return res.status(404).json({ status: "error", error: "User not found" })
        }
        res.json({ status: 'ok', message: 'User deleted successfully' })
    }
    catch (error) {
        res.status(500).json({ status: 'error', error: "Internal server error" })
        console.log(error)
    }
})
 */


app.post('/api/weather', async (req, res) => {
    const { location } = req.body

    console.log(location);

    if (!location) {
        return res.json({ status: 'error', error: "invalid location" })
    }

    try {
        const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}`)
        const weatherData = weatherResponse.data;

        const temperatureKelvin = weatherData.main.temp
        const temperatureCelsius = (temperatureKelvin - 273.15).toFixed(2)
        const humidity = weatherData.main.humidity
        const description = weatherData.weather[0].description

        const newForecast = new Weather({
            location,
            temperature: parseFloat(temperatureCelsius),
            humidity,
            description

        })

        await newForecast.save()

        res.json({ status: 'ok', data: newForecast })
    } catch (error) {
        console.log('Error fetching weather data', error)
        res.status(500).json({ status: 'error', error: 'Error fetching weather data' })

    }


})

app.put('/api/weather/:location', async (req, res) => {
    const { location } = req.params
    const { temperature, humidity, description } = req.body

    if (!location) {
        return res.status(400).json({ status: 'error', error: 'Invalid Location' })
    }

    try {

        const weatherData = await Weather.findOne({ location })

        if (!weatherData) {
            return res.status(400).json({ status: 'error', error: "weather data not found!" })
        }

        weatherData.temperature = temperature
        weatherData.humidity = humidity
        weatherData.description = description


        await weatherData.save()
        res.status(200).json({ status: "success", data: weatherData })

    } catch (error) {
        console.log('Error updating weather data:', error);
        res.status(500).json({ status: 'error', error: 'Error updating weather data' })
    }
})

app.post('/weathernext3hours', async (req, res) => {
    const { city } = req.body
    console.log("City:", city)

    if (!city) {
        return res.status(400).json({ status: 'error', error: 'Invalid city name' })
    }

    try {
        const geocodingResponse = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${GEOCODING_API_KEY}`)
        const geocodingData = geocodingResponse.data


        if (geocodingData.status !== 'OK' || !geocodingData.results || geocodingData.results.length === 0) {
            return res.status(404).json({ status: 'error', error: 'City not found' })
        }


        const location = geocodingData.results[0].geometry.location

        const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${location.lat}&lon=${location.lng}&appid=${apiKey}`)
        const weatherData = weatherResponse.data


        const forecastForNext3Hours = weatherData.list.slice(0, 3).map(item => ({
            time: new Date(item.dt * 1000).toLocaleDateString(),
            temperature: (item.main.temp - 273.15).toFixed(2),
            humidity: item.main.humidity,
            description: item.weather[0].description,
        }))


        res.json({ status: 'ok', data: forecastForNext3Hours })

    } catch (error) {
        console.log("error displaying data:", error)
        res.status(500).json({ status: 'error', error: "Error fetching weather data" })
    }
})

app.post('/weathernext3days', async (req, res) => {
    const { city } = req.body
    console.log("city:", city)

    if (!city) {
        return res.status(400).json({ status: 'error', error: 'Invalid city name' })
    }
    try {
        const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}`)
        const weatherData = weatherResponse.data

        const currentDate = new Date()
        const forecastNext3Days = []

        for (const item of weatherData.list) {
            const date = new Date(item.dt * 1000)

            if (date.getDate() !== currentDate.getDate()) {
                forecastNext3Days.push({
                    date: currentDate.toLocaleDateString(),
                    temperature: (item.main.temp - 273.15).toFixed(2),
                    humidity: item.main.humidity,
                    description: item.weather[0].description,
                })
                currentDate.setDate(date.getDate())
            }
            if (forecastNext3Days.length >= 3) {
                break;
            }
        }
        res.json({ status: 'ok', data: forecastNext3Days })
    }
    catch (error) {
        console.log("error fetching weather data", error)
        res.status(500).json({ status: 'Error', error: "Error fetching data" })
    }
})

app.get('/sunset', async (req, res) => {
    const { location } = req.query
    console.log(location);

    if (!location) {
        return res.json({ status: 'error', error: "Invalid location" })
    }


    try {
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}`)
        const data = response.data


        const sunsetTimeUNIX = data.sys.sunset * 1000
        const sunsetTime = new Date(sunsetTimeUNIX)

        const hours = sunsetTime.getHours()
        const minutes = sunsetTime.getMinutes()


        const formattedTime = `Sunset in ${location} is at ${hours}:${minutes}`

        res.json({ sunset: formattedTime })

    } catch (error) {
        res.status(500).json({ status: 'error', error: `Error fetching the data from the API${error}` })
    }
})

app.post('/api/register', async (req, res) => {
    console.log(req.body)

    const { username, password: plainTextPassword } = req.body

    if (!username || typeof username !== 'string') {
        return res.json({ status: 'error', error: 'Invalid username' })
    }
    if (!plainTextPassword || typeof plainTextPassword !== 'string') {
        return res.json({ status: 'error', error: 'Invalid password' })
    }

    if (plainTextPassword.length < 5) {
        return res.json({ status: 'error', error: 'Password too small. Should be atleast 6 characters' })
    }

    const password = await bcrypt.hash(plainTextPassword, 10)

    try {
        const response = await User.create({
            username,
            password
        })

        console.log('User created successfully,', response)

        res.json({ status: 'ok', data: response })

    }
    catch (error) {
        if (error.code === 11000) {
            return res.json({ status: 'error', error: 'Username already in use' })
        }
        throw error
    }


})



app.listen(9999, () => {
    console.log("Listening at port 9999")
})




