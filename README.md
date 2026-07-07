apt update  
apt upgrade  
apt install git  
git clone this repo pb
cd pb
wget pocketbase  
unzip pocketbase.zip  
rm pocketbase.zip  
nano /lib/systemd/system/pocketbase.service
```
[Unit]
Description = pocketbase

[Service]
Type             = simple
User             = root
Group            = root
LimitNOFILE      = 4096
Restart          = always
RestartSec       = 5s
StandardOutput   = append:/root/pb/std.log
StandardError    = append:/root/pb/std.log
WorkingDirectory = /root/pb
ExecStart        = /root/pb/pocketbase serve backend.peacekhth.uk --origins https://peacekhth.uk

[Install]
WantedBy = multi-user.target
```

cp pb_hooks/config.example pb_hooks/config.js  
nano pb_hooks/config.js

./pocketbase superuser create EMAIL PASS  
systemctl enable pocketbase  
systemctl start pocketbase

# for node script
apt install nodejs npm
npm install
nano .env
crontab -e

# self host embedding model
docker run -d --name bge-m3 -p 8080:80 -v C:\MyAI\data:/data ghcr.io/huggingface/text-embeddings-inference:cpu-1.6 --model-id BAAI/bge-m3
