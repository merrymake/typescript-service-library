tsc
npm publish --otp=$1
git add .
git commit -m "Deploy"
git push origin HEAD

