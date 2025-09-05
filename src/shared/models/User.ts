import { Entity, Fields, Relations } from 'remult'

@Entity('user', {
    dbName: 'camp.user',
    allowApiCrud: true,
})
export class User {
    @Fields.autoIncrement()
    id!: number

    @Fields.string()
    name!: string

    @Fields.string()
    email!: string


    @Relations.toOne(() => UserPassword)
    password!: UserPassword
}

@Entity('userPwd', {
    dbName: 'camp.userPwd',
    allowApiCrud: true,
})
export class UserPassword {
    @Fields.autoIncrement()
    id!: number

    @Fields.string()
    salt!: string

    @Fields.string()
    hash!: string
}