import { withRemult } from 'remult'
import { ActivityTemplate } from '../shared/models/ActivityTemplate'
import { dataProvider } from './db/dataProvider'

export async function createDefaultActivityTemplates(userId: string) {
  await withRemult(async (remult) => {
    remult.user = { id: userId }
    await remult.repo(ActivityTemplate).insert({
      name: 'Km hiked',
      unit: 'km',
      description: 'Distance hiked',
    })
  }, { dataProvider })
}
