import React, { useState, useEffect } from 'react';
import { Search, Filter, Users, Trophy, Heart, BookOpen, Star, MapPin, Phone, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';
import { getPublicProfiles } from '../services/profileService';

const CommunityProfiles: React.FC = () => {
  const [profiles, setProfiles] = useState<User[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedProfession, setSelectedProfession] = useState('all');
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    filterProfiles();
  }, [profiles, searchTerm, selectedGroup, selectedProfession]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const publicProfiles = await getPublicProfiles();
      // 只显示信息相对完整的用户卡片
      const completeProfiles = publicProfiles.filter(profile => {
        // 至少要有群身份或专业信息
        return profile.groupIdentity || profile.profession || 
               (profile.specialties && profile.specialties.length > 0) ||
               (profile.fitnessInterests && profile.fitnessInterests.length > 0) ||
               (profile.learningInterests && profile.learningInterests.length > 0);
      });
      setProfiles(completeProfiles);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProfiles = () => {
    let filtered = profiles;

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(profile =>
        profile.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.groupNickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.profession?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
        profile.fitnessInterests.some(f => f.toLowerCase().includes(searchTerm.toLowerCase())) ||
        profile.learningInterests.some(l => l.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // 群身份过滤
    if (selectedGroup !== 'all') {
      filtered = filtered.filter(profile => profile.groupIdentity === selectedGroup);
    }

    // 专业过滤
    if (selectedProfession !== 'all') {
      filtered = filtered.filter(profile => profile.profession === selectedProfession);
    }

    setFilteredProfiles(filtered);
  };

  const getUniqueGroups = () => {
    const groups = profiles.map(p => p.groupIdentity).filter(Boolean);
    return [...new Set(groups)];
  };

  const getUniqueProfessions = () => {
    const professions = profiles.map(p => p.profession).filter(Boolean);
    return [...new Set(professions)];
  };

  const UserCard: React.FC<{ profile: User }> = ({ profile }) => {
    const isCurrentUser = currentUser?.id === profile.id;
    
    return (
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {profile.nickname}
                {isCurrentUser && <span className="text-sm text-blue-600 ml-2">(我)</span>}
              </h3>
              {profile.groupNickname && (
                <p className="text-sm text-gray-600">群昵称：{profile.groupNickname}</p>
              )}
            </div>
          </div>
          {profile.groupIdentity && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              {profile.groupIdentity}
            </span>
          )}
        </div>

        {profile.bio && (
          <p className="text-gray-600 text-sm mb-4">{profile.bio}</p>
        )}

        {profile.profession && (
          <div className="flex items-center text-sm text-gray-600 mb-3">
            <MapPin className="w-4 h-4 mr-1" />
            <span>专业：{profile.profession}</span>
          </div>
        )}

        {/* 擅长领域 */}
        {profile.specialties.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center text-sm text-gray-700 mb-2">
              <Trophy className="w-4 h-4 mr-1" />
              <span>擅长领域</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {profile.specialties.slice(0, 3).map((specialty, index) => (
                <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                  {specialty}
                </span>
              ))}
              {profile.specialties.length > 3 && (
                <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded">
                  +{profile.specialties.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 健身爱好 */}
        {profile.fitnessInterests.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center text-sm text-gray-700 mb-2">
              <Heart className="w-4 h-4 mr-1" />
              <span>健身爱好</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {profile.fitnessInterests.slice(0, 3).map((interest, index) => (
                <span key={index} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                  {interest}
                </span>
              ))}
              {profile.fitnessInterests.length > 3 && (
                <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded">
                  +{profile.fitnessInterests.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 学习兴趣 */}
        {profile.learningInterests.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center text-sm text-gray-700 mb-2">
              <BookOpen className="w-4 h-4 mr-1" />
              <span>学习兴趣</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {profile.learningInterests.slice(0, 3).map((interest, index) => (
                <span key={index} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">
                  {interest}
                </span>
              ))}
              {profile.learningInterests.length > 3 && (
                <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded">
                  +{profile.learningInterests.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 力量数据 */}
        {(profile.powerData.bench > 0 || profile.powerData.squat > 0 || profile.powerData.deadlift > 0) && (
          <div className="border-t pt-3">
            <div className="text-sm text-gray-700 mb-2">力量数据 (kg)</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-600">卧推</div>
                <div className="font-semibold">{profile.powerData.bench || '-'}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">深蹲</div>
                <div className="font-semibold">{profile.powerData.squat || '-'}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">硬拉</div>
                <div className="font-semibold">{profile.powerData.deadlift || '-'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">🦉 枭马葛大佬卡片墙</h1>
        <p className="text-gray-600">
          展示社区中信息完整的用户卡片，认识志同道合的群友
          <br />
          <span className="text-sm text-gray-500">
            💡 想要出现在这里？请先在个人资料页面完善你的卡片信息
          </span>
        </p>
      </div>

      {/* 搜索和过滤 */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索昵称、专业、擅长领域..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有群</option>
            {getUniqueGroups().map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>

          <select
            value={selectedProfession}
            onChange={(e) => setSelectedProfession(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有专业</option>
            {getUniqueProfessions().map(profession => (
              <option key={profession} value={profession}>{profession}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{profiles.length}</div>
          <div className="text-sm text-gray-600">总用户数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{getUniqueGroups().length}</div>
          <div className="text-sm text-gray-600">活跃群数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{getUniqueProfessions().length}</div>
          <div className="text-sm text-gray-600">专业领域</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{filteredProfiles.length}</div>
          <div className="text-sm text-gray-600">搜索结果</div>
        </div>
      </div>

      {/* 用户卡片列表 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredProfiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProfiles.map((profile) => (
            <UserCard key={profile.id} profile={profile} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">没有找到匹配的用户</h3>
          <p className="text-gray-600">试试调整搜索条件或过滤器</p>
        </div>
      )}
    </div>
  );
};

export default CommunityProfiles; 