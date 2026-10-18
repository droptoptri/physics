import type { Tender, User } from './api'

export const demoUser: User = {
  id: -1,
  name: 'Партнёр',
  email: 'demo@example.com',
  company: 'Демонстрационная компания',
  approved: 1,
}
const dateAfter = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10)
export const demoTenders: Tender[] = [
  {
    id: -1,
    title: 'Демо · Строительство промышленного объекта',
    category: 'Промышленное строительство',
    region: 'Центральный федеральный округ',
    description: 'Демонстрационный пример для проверки интерфейса. Здесь будут состав работ, требования к участнику и условия проекта. Это не действующая закупка; отклики не принимаются.',
    deadline: dateAfter(30),
    contact: 'demo@example.com',
  },
  {
    id: -2,
    title: 'Демо · Развитие инженерной инфраструктуры',
    category: 'Инженерные системы',
    region: 'Урал',
    description: 'Демонстрационный пример для проверки поиска, фильтров и раскрытия карточки. Реальные предложения доступны только подтверждённым партнёрам в серверной версии.',
    deadline: dateAfter(45),
    contact: 'demo@example.com',
  },
]
