import beefNoodleUrl from './demo/beef-noodle.svg'
import chickenRiceUrl from './demo/chicken-rice.svg'
import riceBallUrl from './demo/rice-ball.svg'
import sweetPorkUrl from './demo/sweet-pork.svg'

export const DEMO_REVIEWS = [
  {
    id: 'demo-1',
    floor: 1,
    stall: '西北风味窗口',
    dish_name: '孜然鸡排拌饭',
    price: 15,
    rating: 5,
    review_text: '鸡排现炸，边缘是脆的，孜然味够但不齁。米饭要是再多半勺，直接封神。',
    nickname: '不愿早八',
    image_url: chickenRiceUrl,
    like_count: 46,
    comment_count: 2,
    liked_by_me: false,
    created_at: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-2',
    floor: 2,
    stall: '自选称重区',
    dish_name: '糖醋里脊套餐',
    price: 13.5,
    rating: 4,
    review_text: '酸甜口很稳，里脊没有全是面衣。中午十二点后排队会长，建议下课直接冲。',
    nickname: '印刷机不冒烟',
    image_url: sweetPorkUrl,
    like_count: 31,
    comment_count: 1,
    liked_by_me: true,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-3',
    floor: 3,
    stall: '面食窗口',
    dish_name: '番茄肥牛面',
    price: 16,
    rating: 3,
    review_text: '汤底挺顺口，肥牛数量看窗口师傅当天手感。适合冷天吃，夏天略显战斗力过剩。',
    nickname: '三楼侦察员',
    image_url: beefNoodleUrl,
    like_count: 18,
    comment_count: 1,
    liked_by_me: false,
    created_at: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-4',
    floor: 1,
    stall: '早餐档',
    dish_name: '肉松饭团',
    price: 6,
    rating: 2,
    review_text: '能填肚子，但米偏硬，肉松存在感比较礼貌。赶早八可以买，不赶时间建议再看看。',
    nickname: '卡点到教室',
    image_url: riceBallUrl,
    like_count: 9,
    comment_count: 0,
    liked_by_me: false,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
]

export const DEMO_COMMENTS = {
  'demo-1': [
    {
      id: 'comment-1',
      nickname: '一楼常驻',
      body: '同意，鸡排刚出锅的时候最夯。',
      created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
    {
      id: 'comment-2',
      nickname: '加饭组选手',
      body: '可以跟师傅说多一点饭，我上次加了没收费。',
      created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    },
  ],
  'demo-2': [
    {
      id: 'comment-3',
      nickname: '糖醋派',
      body: '这家要避开最后一锅，刚出锅确实顶。',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ],
}
