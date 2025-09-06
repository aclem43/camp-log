import { Entity, Fields, Relations } from 'remult'
import { UserPassword } from './UserPassword'

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
