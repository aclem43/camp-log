import { Entity, Fields } from "remult"

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