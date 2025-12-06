#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
播放列表生成脚本
扫描 musics 目录并生成 playlist.json 配置文件
支持格式: mp3, flac, wav, ogg, aac, m4a, webm
"""

import os
import json
from datetime import datetime
from typing import List, Dict, Optional
from zoneinfo import ZoneInfo

# 支持的音频格式
SUPPORTED_FORMATS = {'mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'webm'}


def parse_filename(filename: str) -> Dict[str, str]:
    """
    解析文件名，提取艺术家和歌曲名
    支持格式: 
    - "艺术家 - 歌曲名.格式"
    - "歌曲名 - 艺术家.格式"
    - "艺术家- 歌曲名.格式" (分隔符前无空格)
    - "歌曲名.格式" (无分隔符)
    
    Args:
        filename: 音乐文件名
        
    Returns:
        包含 artist, title, format 的字典
    """
    # 常见艺术家名列表（用于智能识别）
    KNOWN_ARTISTS = [
        '周杰伦', '华晨宇', '林俊杰', '陈奕迅', '邓紫棋', '薛之谦',
        '李荣浩', '毛不易', '许嵩', '汪苏泷', '张杰', '王力宏',
        '蔡依林', '孙燕姿', '梁静茹', '张韶涵', '田馥甄', '邓丽君',
        'Jay Chou', 'JJ Lin', 'Eason Chan'
    ]
    
    # 分隔符模式（按优先级排序）
    SEPARATORS = [' - ', '- ', ' -', '-']
    
    # 获取文件扩展名
    name, ext = os.path.splitext(filename)
    file_format = ext[1:].lower() if ext else ''
    
    # 尝试用各种分隔符解析
    for sep in SEPARATORS:
        if sep in name:
            idx = name.find(sep)
            if idx > 0 and idx < len(name) - len(sep):
                left_part = name[:idx].strip()
                right_part = name[idx + len(sep):].strip()
                
                if left_part and right_part:
                    # 检查哪边是艺术家
                    left_is_artist = any(artist.lower() in left_part.lower() for artist in KNOWN_ARTISTS)
                    right_is_artist = any(artist.lower() in right_part.lower() for artist in KNOWN_ARTISTS)
                    
                    if right_is_artist and not left_is_artist:
                        # 格式: 歌曲名 - 艺术家
                        return {
                            'artist': right_part,
                            'title': left_part,
                            'format': file_format
                        }
                    else:
                        # 默认格式: 艺术家 - 歌曲名
                        return {
                            'artist': left_part,
                            'title': right_part,
                            'format': file_format
                        }
    
    # 无分隔符，整个名称作为歌曲名
    return {
        'artist': '未知艺术家',
        'title': name.strip(),
        'format': file_format
    }


def scan_music_directory(directory: str) -> List[Dict[str, str]]:
    """
    扫描音乐目录，返回所有支持格式的音乐文件信息
    
    Args:
        directory: 音乐目录路径
        
    Returns:
        音乐文件信息列表
    """
    tracks = []
    
    if not os.path.exists(directory):
        print(f"目录不存在: {directory}")
        return tracks
    
    for filename in os.listdir(directory):
        # 获取文件扩展名
        _, ext = os.path.splitext(filename)
        file_format = ext[1:].lower() if ext else ''
        
        # 检查是否为支持的格式
        if file_format not in SUPPORTED_FORMATS:
            continue
        
        # 解析文件名
        track_info = parse_filename(filename)
        
        # 构建完整的音轨信息
        track = {
            'filename': filename,
            'path': f'musics/{filename}',
            'artist': track_info['artist'],
            'title': track_info['title'],
            'format': track_info['format']
        }
        
        tracks.append(track)
    
    # 按文件名排序
    tracks.sort(key=lambda x: x['filename'])
    
    return tracks


def generate_playlist_json(tracks: List[Dict[str, str]], output_path: str) -> None:
    """
    生成 playlist.json 文件
    
    Args:
        tracks: 音乐文件信息列表
        output_path: 输出文件路径
    """
    playlist = {
        'version': '1.0',
        'generatedAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
        'tracks': tracks
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(playlist, f, ensure_ascii=False, indent=4)
    
    print(f"已生成播放列表: {output_path}")
    print(f"共 {len(tracks)} 首歌曲")


def main():
    """主函数"""
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 音乐目录路径
    music_dir = os.path.join(script_dir, 'musics')
    
    # 输出文件路径
    output_path = os.path.join(script_dir, 'playlist.json')
    
    print(f"扫描目录: {music_dir}")
    print(f"支持格式: {', '.join(sorted(SUPPORTED_FORMATS))}")
    print("-" * 40)
    
    # 扫描音乐目录
    tracks = scan_music_directory(music_dir)
    
    if tracks:
        # 显示找到的歌曲
        for i, track in enumerate(tracks, 1):
            print(f"{i}. {track['artist']} - {track['title']} ({track['format']})")
        print("-" * 40)
    else:
        print("未找到任何音乐文件")
    
    # 生成播放列表
    generate_playlist_json(tracks, output_path)


if __name__ == '__main__':
    main()
