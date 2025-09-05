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

    @Fields.string()
    password!: string
}
