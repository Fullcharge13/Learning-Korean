# Sources / 资料来源

本文件记录公开数据的主要来源、用途和修改方式。来源署名不表示相关机构参与、
赞助或认可本项目。

## 课程顺序与初始中文释义

册次、课次、单元顺序和初始中文释义来自项目贡献者提供的 Anki 卡组。项目所有者
已确认相关整理内容可公开再发布、修改和转换格式。原始卡组本身不随仓库发布。

原始输入包含 4,450 条记录；整理过程中修复了 13 条字段错位、合并 2 条续行并
移除 3 条同单元重复项，最终公开 4,445 条记录。

项目不发布教材扫描页、课文、例句、练习、答案、音频、封面或官方视觉素材。

## 词典资料

韩语拼写、词性、英文义项、汉字或外来语来源及必要发音，主要参考：

1. [韩国语基础词典](https://krdict.korean.go.kr/)
2. [NIKL Korean-English Dictionary](https://huggingface.co/datasets/binjang/NIKL-korean-english-dictionary)
3. [Multilingual Korean Basic Dictionary](https://huggingface.co/datasets/hac541309/basic_korean_dict)

v0.1.0 使用的固定版本：

| 来源 | Revision | 用途 |
|---|---|---|
| `binjang/NIKL-korean-english-dictionary` | `3b4cfd2126debfd5440cade3ef6c2a3c20cf7cf9` | 韩英义项、词性候选 |
| `hac541309/basic_korean_dict` | `1ba29964518a8e859e5898cdeacfc46ff8215a60` | 多语言义项、词源、发音候选 |

词典候选并非自动视为最终答案。项目按课程语境选择义项，统一字符与字段，省略
例句和未使用内容，并对错字、同形词、完整表达及缺失英文义项作必要修订。

## 许可与机构信息

- [韩国国立国语院版权政策](https://www.korean.go.kr/front/page/pageView.do?mn_id=105&page_id=P000189)
- [韩国语基础词典帮助与使用说明](https://krdict.korean.go.kr/m/kor/help)
- [延世大学韩国语学堂](https://www.yskli.com/about.php)

详细许可和第三方说明见 [`LICENSE.md`](LICENSE.md) 与
[`LICENSES/THIRD_PARTY_NOTICES.md`](LICENSES/THIRD_PARTY_NOTICES.md)。

本项目为独立项目；机构和教材名称仅用于说明资料来源及索引对象，不表示从属、
赞助或背书。
