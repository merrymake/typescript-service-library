npm update \
  && tsc \
  && npm publish --otp=$1 \
  && git add . \
  && git commit -m "Release" \
  && git push origin HEAD

