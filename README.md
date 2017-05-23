# geo-buffer
Creates "buffers" of arbitrary size around parks in San Francisco, using Mapbox Gl and Turf.js. Each GeoJson object (SF park) is "enlarged" with the value (in meters) of the input range control. The visualization demonstrates how overlapping GeoJson objects can be merged. Please note: the polygon merge process is currently unoptimized (meaning, for example, that **each** polygon is unnecessarily tested for overlap against **all others**), and will be improved by **quad trees**.

**Screenshots**

**Parks in San Francisco: Zero buffer**

![Screenshot](https://github.com/boeric/geo-buffer/blob/master/screenshots/SF%20Parks%200%20buffer.png)

**Parks in San Francisco: 200 meter buffer**

![Screenshot](https://github.com/boeric/geo-buffer/blob/master/screenshots/SF%20Parks%20200m%20buffer.png)

**Parks in San Francisco: 200 meter buffer with joined/merged polygons**

![Screenshot](https://github.com/boeric/geo-buffer/blob/master/screenshots/SF%20Parks%20200m%20buffer%20merged.png)
