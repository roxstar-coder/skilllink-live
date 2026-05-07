const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const sendMail = require('../mailer');

const OTP_EXPIRY_MINUTES = 10;
const TRUSTED_DEVICE_DAYS = Number(process.env.TRUSTED_DEVICE_DAYS || 30);
const DEV_OTP_FALLBACK_ENABLED = process.env.ALLOW_DEV_OTP_FALLBACK === 'true';
const ADMIN_EMAIL = 'anishdask10@gmail.com';

function createToken(user) {
    return jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'SECRET_KEY');
}

function getSafeUser(user) {
    return { _id: user._id, name: user.name, email: user.email, role: user.role, profilePhoto: user.profilePhoto || null };
}

async function ensureAdminRole(user) {
    if (user && user.email && user.email.toLowerCase() === ADMIN_EMAIL && user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
    }
    return user;
}

function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
    return crypto
        .createHash('sha256')
        .update(`${otp}:${process.env.OTP_SECRET || process.env.JWT_SECRET || 'SECRET_KEY'}`)
        .digest('hex');
}

function hashTrustedDeviceToken(token) {
    return crypto
        .createHash('sha256')
        .update(`${token}:${process.env.TRUSTED_DEVICE_SECRET || process.env.OTP_SECRET || process.env.JWT_SECRET || 'SECRET_KEY'}`)
        .digest('hex');
}

function createTrustedDeviceToken() {
    return crypto.randomBytes(32).toString('hex');
}

function pruneExpiredTrustedDevices(user) {
    const now = Date.now();
    const trustedDevices = Array.isArray(user.trustedDevices) ? user.trustedDevices : [];
    user.trustedDevices = trustedDevices.filter(device => new Date(device.expiresAt).getTime() > now);
}

function findTrustedDevice(user, rawToken) {
    if (!rawToken) return null;
    const trustedDevices = Array.isArray(user.trustedDevices) ? user.trustedDevices : [];
    const tokenHash = hashTrustedDeviceToken(rawToken);
    return trustedDevices.find(device => device.tokenHash === tokenHash) || null;
}

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const normalizedEmail = String(email).trim().toLowerCase();
        const user = new User({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            role: normalizedEmail === ADMIN_EMAIL ? 'admin' : 'user'
        });
        await user.save();
        res.json({ message: 'User registered successfully!' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password, trustedDeviceToken } = req.body;
        const user = await User.findOne({ email: String(email).trim().toLowerCase() });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        await ensureAdminRole(user);
        pruneExpiredTrustedDevices(user);

        const matchedTrustedDevice = findTrustedDevice(user, trustedDeviceToken);
        if (matchedTrustedDevice) {
            matchedTrustedDevice.lastUsedAt = new Date();
            matchedTrustedDevice.expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);
            user.loginOtpHash = null;
            user.loginOtpExpiresAt = null;
            await user.save();

            return res.json({
                token: createToken(user),
                user: getSafeUser(user),
                trustedLogin: true,
                message: 'Welcome back.'
            });
        }

        const otp = generateOtp();
        user.loginOtpHash = hashOtp(otp);
        user.loginOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        await user.save();

        try {
            await sendMail(
                user.email,
                'Your SkillLink login OTP',
                `
                    <div style="font-family:Arial,sans-serif; line-height:1.5;">
                        <h2>SkillLink login verification</h2>
                        <p>Use this OTP to finish signing in:</p>
                        <div style="font-size:28px; font-weight:bold; letter-spacing:4px; margin:16px 0;">${otp}</div>
                        <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
                        <p>If you did not request this login, you can ignore this email.</p>
                    </div>
                `
            );

            res.json({
                otpRequired: true,
                message: 'OTP sent to your email. Please verify to continue.',
                email: user.email
            });
        } catch (mailError) {
            if (!DEV_OTP_FALLBACK_ENABLED) {
                throw mailError;
            }

            res.json({
                otpRequired: true,
                email: user.email,
                otpPreview: otp,
                message: 'Email delivery failed locally. Use the OTP shown below to continue.'
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Login error', error: error.message });
    }
};

exports.verifyLoginOtp = async (req, res) => {
    try {
        const { email, otp, rememberDevice, deviceName } = req.body;

        if (!email || !/^\d{6}$/.test(String(otp || ''))) {
            return res.status(400).json({ message: 'Valid email and 6-digit OTP are required' });
        }

        const user = await User.findOne({ email: String(email).trim().toLowerCase() });
        if (!user || !user.loginOtpHash || !user.loginOtpExpiresAt) {
            return res.status(400).json({ message: 'No active OTP found. Please log in again.' });
        }
        await ensureAdminRole(user);

        if (user.loginOtpExpiresAt.getTime() < Date.now()) {
            user.loginOtpHash = null;
            user.loginOtpExpiresAt = null;
            await user.save();
            return res.status(400).json({ message: 'OTP expired. Please log in again.' });
        }

        if (user.loginOtpHash !== hashOtp(String(otp))) {
            return res.status(401).json({ message: 'Invalid OTP' });
        }

        user.loginOtpHash = null;
        user.loginOtpExpiresAt = null;
        pruneExpiredTrustedDevices(user);

        let issuedTrustedDeviceToken = null;
        if (rememberDevice !== false) {
            issuedTrustedDeviceToken = createTrustedDeviceToken();
            const tokenHash = hashTrustedDeviceToken(issuedTrustedDeviceToken);
            user.trustedDevices.push({
                tokenHash,
                deviceName: String(deviceName || '').slice(0, 200),
                lastUsedAt: new Date(),
                expiresAt: new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000)
            });

            if (user.trustedDevices.length > 8) {
                user.trustedDevices = user.trustedDevices
                    .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
                    .slice(0, 8);
            }
        }
        await user.save();

        const token = createToken(user);
        res.json({
            token,
            user: getSafeUser(user),
            trustedDeviceToken: issuedTrustedDeviceToken
        });
    } catch (error) {
        res.status(500).json({ message: 'OTP verification error', error: error.message });
    }
};

exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        await ensureAdminRole(user);
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
};
