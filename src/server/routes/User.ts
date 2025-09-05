import { User, UserPassword } from '../../shared/models/User'
import { Router } from 'express'
import { remult } from 'remult'
import crypto from 'node:crypto'
const router: Router = Router()

router.get('/login', (req, res) => {
    res.json({ loggedIn: !!req.session!.user, user: req.session!.user ?? null })
})

router.post('/login', async (req, res) => {
    const userRepo = remult.repo(User)
    const us = await userRepo.find({ where: { email: req.body.email }, include: { password: true } })
    if (!us || us.length === 0) {
        res.json({ success: false, message: 'Invalid email or password' })
        return
    }
    const user = us[0]
    const hash = crypto.createHash('sha256').update(user.password.salt + req.body.password).digest('hex')
    if (user && user.password.hash === hash) {
        req.session!.user = { id: user.id, email: user.email }
        res.json({ success: true, user: user })
    } else {
        res.json({ success: false, message: 'Invalid email or password' })
    }
})

router.post('/register', async (req, res) => {
    const userRepo = remult.repo(User)
    const userPwdRepo = remult.repo(UserPassword)
    const existingUser = await userRepo.findFirst({ email: req.body.email })
    if (existingUser) {
        res.json({ success: false, message: 'Email already in use' })
        return
    }
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.createHash('sha256').update(salt + req.body.password).digest('hex')
    const newUser = await userRepo.insert({
        email: req.body.email,
        name: req.body.name
    })
    const userPassword = await userPwdRepo.insert({
        hash: hash,
        salt: salt
    })
    await userRepo.update(newUser, { password: userPassword })
    req.session!.user = { id: newUser.id, email: newUser.email }
    res.json({ success: true, user: newUser })
})


router.get('/logout', (req, res) => {
    req.session!.destroy(() => {
        res.send('Logged out')
    })
})

export default router
