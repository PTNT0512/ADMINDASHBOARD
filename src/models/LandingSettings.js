const mongoose = require('mongoose');

const landingSettingsSchema = new mongoose.Schema({
  // Logo & Branding
  logoUrl: { 
    type: String, 
    default: 'https://i.imgur.com/vazRsQJ.png',
    description: 'URL của logo landing page'
  },
  
  // Main Title
  mainTitle: { 
    type: String, 
    default: 'OK999.SITE',
    description: 'Tiêu đề chính của trang landing'
  },
  
  // Subtitle
  subtitle: { 
    type: String, 
    default: 'Đẳng cấp Casino Quốc Tế',
    description: 'Mô tả phụ'
  },
  
  // Bot Settings
  botName: { 
    type: String, 
    default: 'MIG30 Support Bot',
    description: 'Tên bot hỗ trợ'
  },
  
  // CTA Button
  ctaButtonText: { 
    type: String, 
    default: 'TRUY CẬP BOT NGAY',
    description: 'Text nút chính'
  },
  
  ctaButtonColor: { 
    type: String, 
    default: '#229ED9',
    description: 'Màu nút chính (hex)'
  },
  
  ctaButtonHoverColor: { 
    type: String, 
    default: '#1e8bc0',
    description: 'Màu nút khi hover'
  },

  ctaButtonUrl: { 
    type: String, 
    default: 't.me/MIG30VIP_bot',
    description: 'URL của nút CTA'
  },
  
  // Gift Code
  giftCode: { 
    type: String, 
    default: 'MIG30VIP',
    description: 'Mã quà tặng'
  },
  
  giftButtonText: { 
    type: String, 
    default: 'Nhận Code',
    description: 'Text nút nhận code'
  },

  giftButtonUrl: { 
    type: String, 
    default: '',
    description: 'URL của nút nhận code'
  },
  
  // Support Button
  supportButtonText: { 
    type: String, 
    default: 'Hỗ Trợ',
    description: 'Text nút hỗ trợ'
  },

  supportButtonUrl: { 
    type: String, 
    default: 't.me/MIG30VIP_bot',
    description: 'URL của nút hỗ trợ'
  },
  
  // Bot Link (kept for backward compatibility)
  botLink: { 
    type: String, 
    default: 't.me/MIG30VIP_bot',
    description: 'Link bot Telegram'
  },
  
  // Trust Badges
  trustBadges: { 
    type: Array, 
    default: [
      { label: 'Nạp Rút', value: '24/7', color: 'text-yellow-500' },
      { label: 'Tốc độ', value: '1s', color: 'text-green-500' },
      { label: 'Bảo mật', value: '100%', color: 'text-blue-500' }
    ],
    description: 'Các huy hiệu tin tưởng'
  },
  
  // Footer
  copyrightText: { 
    type: String, 
    default: '© 2025 MIG30.VIP Entertainment. All rights reserved.',
    description: 'Text bản quyền'
  }
}, { timestamps: true });

module.exports = mongoose.models.LandingSettings || mongoose.model('LandingSettings', landingSettingsSchema);
