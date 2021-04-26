# 青空文庫検索アプリ

## 使い方

### 1. リポジトリからコンテンツをDL

```shell
$ git clone git@github.com:aozorabunko/aozorabunko.git
```

### 2. 設定ファイルを作成

.envファイルを作成し、下記設定値を設定

```config
DB_HOST=
DB_NAME=
DB_USER=
DB_PASS=
```

### 3. Dockerコンテナ起動

```shell
$ docker-compose up -d
```

## 問題点

## 将来的に追加したい機能

でかめの展望はfeaturesディレクトリに配置する。

* **速度を上げる**

* View書く

	* 検索

	* 詳細
