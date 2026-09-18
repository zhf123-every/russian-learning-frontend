export const LEVELS = ['A1']

export const courseLibrary = {
  A1: {
    collections: [
      {
        id: 'privet_rossiya_a1',
        name: 'Привет, Россия! A1',
        description: 'A1 级别俄语入门课程，12 个单元，覆盖问候、地点、拥有、运动、数量、喜好、必须、过去时、将来时、从句等核心语法。',
        videos: [
          {
            id: 'u1',
            title: 'Урок 1',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u1/400/280',
            posterUrl: 'https://picsum.photos/seed/u1/1280/720',
            level: 'A1',
            duration: '15:00',
            words: 87,
            tags: ['问候', '自我介绍', 'easy'],
            learners: 128,
            sentences: []
          },
          {
            id: 'u2',
            title: 'Урок 2',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u2/400/280',
            posterUrl: 'https://picsum.photos/seed/u2/1280/720',
            level: 'A1',
            duration: '10:00',
            words: 41,
            tags: ['地点', '方位', 'easy'],
            learners: 96,
            sentences: []
          },
          {
            id: 'u3',
            title: 'Урок 3',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u3/400/280',
            posterUrl: 'https://picsum.photos/seed/u3/1280/720',
            level: 'A1',
            duration: '8:00',
            words: 22,
            tags: ['拥有', 'easy'],
            learners: 85,
            sentences: []
          },
          {
            id: 'u4',
            title: 'Урок 4',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u4/400/280',
            posterUrl: 'https://picsum.photos/seed/u4/1280/720',
            level: 'A1',
            duration: '15:00',
            words: 60,
            tags: ['现在时', '日常活动', 'medium'],
            learners: 72,
            sentences: []
          },
          {
            id: 'u5',
            title: 'Урок 5',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u5/400/280',
            posterUrl: 'https://picsum.photos/seed/u5/1280/720',
            level: 'A1',
            duration: '20:00',
            words: 80,
            tags: ['运动', '方向', 'medium'],
            learners: 68,
            sentences: []
          },
          {
            id: 'u6',
            title: 'Урок 6',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u6/400/280',
            posterUrl: 'https://picsum.photos/seed/u6/1280/720',
            level: 'A1',
            duration: '10:00',
            words: 23,
            tags: ['数量', '数字', 'medium'],
            learners: 65,
            sentences: []
          },
          {
            id: 'u7',
            title: 'Урок 7',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u7/400/280',
            posterUrl: 'https://picsum.photos/seed/u7/1280/720',
            level: 'A1',
            duration: '8:00',
            words: 21,
            tags: ['喜好', 'hard'],
            learners: 58,
            sentences: []
          },
          {
            id: 'u8',
            title: 'Урок 8',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u8/400/280',
            posterUrl: 'https://picsum.photos/seed/u8/1280/720',
            level: 'A1',
            duration: '10:00',
            words: 26,
            tags: ['必须', 'hard'],
            learners: 52,
            sentences: []
          },
          {
            id: 'u9',
            title: 'Урок 9',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u9/400/280',
            posterUrl: 'https://picsum.photos/seed/u9/1280/720',
            level: 'A1',
            duration: '10:00',
            words: 25,
            tags: ['过去时', 'hard'],
            learners: 48,
            sentences: []
          },
          {
            id: 'u10',
            title: 'Урок 10',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u10/400/280',
            posterUrl: 'https://picsum.photos/seed/u10/1280/720',
            level: 'A1',
            duration: '8:00',
            words: 20,
            tags: ['将来时', 'medium'],
            learners: 45,
            sentences: []
          },
          {
            id: 'u11',
            title: 'Урок 11',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u11/400/280',
            posterUrl: 'https://picsum.photos/seed/u11/1280/720',
            level: 'A1',
            duration: '10:00',
            words: 22,
            tags: ['从句', 'medium'],
            learners: 42,
            sentences: []
          },
          {
            id: 'u12',
            title: 'Урок 12',
            description: 'A1基础句子学习',
            thumbnail: 'https://picsum.photos/seed/u12/400/280',
            posterUrl: 'https://picsum.photos/seed/u12/1280/720',
            level: 'A1',
            duration: '12:00',
            words: 36,
            tags: ['复习', '综合', 'medium'],
            learners: 40,
            sentences: []
          }
        ]
      }
    ]
  }
}

export function getLevelVideos(level) {
  const levelData = courseLibrary[level]
  if (!levelData) return []
  return levelData.collections.flatMap(c => c.videos)
}

export function getCollectionInfo(level) {
  const levelData = courseLibrary[level]
  if (!levelData || !levelData.collections[0]) return null
  const c = levelData.collections[0]
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    videoCount: c.videos.length
  }
}

export function findVideo(videoId) {
  for (const level of LEVELS) {
    const levelData = courseLibrary[level]
    if (!levelData) continue
    for (const collection of levelData.collections) {
      const video = collection.videos.find(v => v.id === videoId)
      if (video) {
        return { video, level, collection }
      }
    }
  }
  return null
}
