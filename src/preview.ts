import { tr } from './i18n'
import type { Tender, User } from './api';
export const demoUser: User = {
    id: -1,
    name: tr("Партнёр"),
    email: 'demo@example.com',
    company: tr("Демонстрационная компания"),
    approved: 1,
};
const dateAfter = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const demoTenders: Tender[] = [
    {
        id: -1,
        title: tr("Демо \u00B7 Строительство промышленного объекта"),
        category: tr("Промышленное строительство"),
        region: tr("Центральный федеральный округ"),
        description: tr("Демонстрационный пример для проверки интерфейса. Здесь будут состав работ, требования к участнику и условия проекта. Это не действующая закупка; отклики не принимаются."),
        deadline: dateAfter(30),
        contact: 'demo@example.com',
    },
    {
        id: -2,
        title: tr("Демо \u00B7 Развитие инженерной инфраструктуры"),
        category: tr("Инженерные системы"),
        region: tr("Урал"),
        description: tr("Демонстрационный пример для проверки поиска, фильтров и раскрытия карточки. Реальные предложения доступны только подтверждённым партнёрам в серверной версии."),
        deadline: dateAfter(45),
        contact: 'demo@example.com',
    },
];
