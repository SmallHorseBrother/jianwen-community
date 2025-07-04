import React, { useState, useEffect } from 'react';
import { Search, Calendar, User, Loader } from 'lucide-react';
import { getArticles } from '../../services/articleService';
import { Article } from '../../types';

const LearningKnowledge: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categories = [
    { id: 'all', label: '全部' },
    { id: 'method', label: '学习方法' },
    { id: 'time', label: '时间管理' },
    { id: 'memory', label: '记忆技巧' },
    { id: 'exam', label: '考试技巧' },
    { id: 'motivation', label: '学习动力' },
  ];

  useEffect(() => {
    loadArticles();
  }, [selectedCategory]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const filters: any = { type: 'learning' };
      if (selectedCategory !== 'all') {
        filters.category = selectedCategory;
      }
      if (searchTerm) {
        filters.search = searchTerm;
      }
      
      const data = await getArticles(filters);
      setArticles(data);
    } catch (err: any) {
      setError(err.message || '加载文章失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadArticles();
  };

  const filteredArticles = articles.filter(article => {
    if (!searchTerm) return true;
    return article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">学习知识库</h1>
          <p className="text-gray-600 mt-1">系统整理的学习方法和经验分享</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索文章或标签..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          搜索
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadArticles}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* Articles Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map(article => (
            <div key={article.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                  {categories.find(c => c.id === article.category)?.label || article.category}
                </span>
                <div className="flex items-center text-gray-500 text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  {article.createdAt.toLocaleDateString('zh-CN')}
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                {article.title}
              </h3>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {article.summary || article.content.substring(0, 100) + '...'}
              </p>
              
              <div className="flex flex-wrap gap-1 mb-4">
                {article.tags.map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-gray-500 text-xs">
                  <User className="w-3 h-3 mr-1" />
                  {article.author}
                </div>
                <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                  阅读全文
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchTerm ? '没有找到相关文章' : '暂无文章，敬请期待！'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LearningKnowledge;