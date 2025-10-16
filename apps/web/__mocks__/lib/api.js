const mockApi = {
  post: jest.fn(async (path, body) => {
    if (path === '/api/Auth/login' && body.username === 'admin' && body.password === 'admin123') {
      return { data: { success: true, data: { accessToken: 'fake-token', user: { id:1, username: 'admin', fullName: 'المدير الأساسي', role: 'primary_admin' } } } }
    }
    return { data: { success: false } }
  }),
  get: jest.fn(),
}

module.exports = mockApi
