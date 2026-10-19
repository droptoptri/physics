FROM php:8.3-apache
RUN docker-php-ext-install -j2 pdo_mysql && a2enmod rewrite headers
RUN sed -ri 's!/var/www/html!/site/public!g' /etc/apache2/sites-available/000-default.conf \
    && printf '<Directory /site/public>\nAllowOverride All\nRequire all granted\n</Directory>\n' > /etc/apache2/conf-available/sgt.conf \
    && a2enconf sgt
COPY --chown=www-data:www-data . /site/
RUN chmod -R u+rwX /site
