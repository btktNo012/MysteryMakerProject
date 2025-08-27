import fs from 'fs';
import path from 'path';

// シナリオ/スキル情報の読み込み
const scenarioPath = path.join(__dirname, '../client/public/scenario.json');
const skillInfoPath = path.join(__dirname, '../client/public/skill_info.json');

// JSONファイルはサーバー起動時に同期で読み込む
export const scenarioData = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'));
export const skillInfoData = JSON.parse(fs.readFileSync(skillInfoPath, 'utf-8'));

export const maxPlayers: number = (scenarioData.characters || []).filter((c: any) => c.type === 'PC').length;

