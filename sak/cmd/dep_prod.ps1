# Deploy simple: gcp -> master
Write-Host "Deploying gcp to master..." -ForegroundColor Cyan

git fetch origin
git checkout master
git pull origin master
git merge origin/gcp --no-edit
git push origin master

Write-Host "Deploy completed!" -ForegroundColor Green
