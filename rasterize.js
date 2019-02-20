/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const TESTING = false;
const BASE_URL = "https://ncsucgclass.github.io/prog4/"; // prog4 shell base url
const INPUT_TRIANGLES_URL = BASE_URL + "triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = BASE_URL + "ellipsoids.json"; // triangles file loc
const EPSILON = 0.000001; // error value for floating point numbers
const TRANS_OPAQUE_BORDER = 1.0 - EPSILON; // the alpha border between transparent and opaque objects
var defaultEye = vec3.fromValues(0.5, 0.5, -0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5, 0.5, 0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0, 1, 0); // default view up vector
var lightAmbient = vec3.fromValues(1, 1, 1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1, 1, 1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1, 1, 1); // default light specular emission
var lightPosition = vec3.fromValues(-1, 3, -0.5); // default light position
var rotateTheta = Math.PI / 50; // how much to rotate models by with each key press
var Blinn_Phong = true;
var Modulation = 0; // modulation toggle

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var strucTriangles = []; // the structured triangle data for transparent triangles
var numTriangles = 0; // how many transparent triangles in input scene
// var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
// var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
// var normalBuffers = []; // this contains normal component lists by set, in triples
// var textureBuffers = []; // this contains texture coordinate lists by set, in triples
// var triSetSizes = []; // this contains the size of each triangle set
// var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
var viewDelta = 0; // how much to displace view with each key press

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc; // where to put normal for vertex shader
var vTexAttribLoc; // where to put texture coords for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var alphaULoc; // where to put alpha value for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var Blinn_PhongULoc;
var ModulationULoc; // where to put modulation toggle for fragment shader
var samplerULoc; // where to put texture for fragment shader

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url, descr) {
    try {
        if ((typeof (url) !== "string") || (typeof (descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET", url, false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open " + descr + " file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try    

    catch (e) {
        console.log(e);
        return (String.null);
    }
} // end get input json file

// does stuff when keys are pressed
function handleKeyDown(event) {

    const modelEnum = { TRIANGLES: "triangles", ELLIPSOID: "ellipsoid" }; // enumerated model type
    const dirEnum = { NEGATIVE: -1, POSITIVE: 1 }; // enumerated rotation direction

    function highlightModel(modelType, whichModel) {
        if (handleKeyDown.modelOn != null)
            handleKeyDown.modelOn.on = false;
        handleKeyDown.whichOn = whichModel;
        if (modelType == modelEnum.TRIANGLES)
            handleKeyDown.modelOn = inputTriangles[whichModel];
        else
            handleKeyDown.modelOn = inputEllipsoids[whichModel];
        handleKeyDown.modelOn.on = true;
    } // end highlight model

    function translateModel(offset) {
        if (handleKeyDown.modelOn != null)
            vec3.add(handleKeyDown.modelOn.translation, handleKeyDown.modelOn.translation, offset);
    } // end translate model

    function rotateModel(axis, direction) {
        if (handleKeyDown.modelOn != null) {
            var newRotation = mat4.create();

            mat4.fromRotation(newRotation, direction * rotateTheta, axis); // get a rotation matrix around passed axis
            vec3.transformMat4(handleKeyDown.modelOn.xAxis, handleKeyDown.modelOn.xAxis, newRotation); // rotate model x axis tip
            vec3.transformMat4(handleKeyDown.modelOn.yAxis, handleKeyDown.modelOn.yAxis, newRotation); // rotate model y axis tip
        } // end if there is a highlighted model
    } // end rotate model

    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt, vec3.subtract(temp, Center, Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight, vec3.cross(temp, lookAt, Up)); // get view right vector

    // highlight static variables
    handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
    handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

    switch (event.code) {

        // model selection
        case "Space":
            if (handleKeyDown.modelOn != null)
                handleKeyDown.modelOn.on = false; // turn off highlighted model
            handleKeyDown.modelOn = null; // no highlighted model
            handleKeyDown.whichOn = -1; // nothing highlighted
            break;
        case "ArrowRight": // select next triangle set
            highlightModel(modelEnum.TRIANGLES, (handleKeyDown.whichOn + 1) % numTriangleSets);
            break;
        case "ArrowLeft": // select previous triangle set
            highlightModel(modelEnum.TRIANGLES, (handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn - 1 : numTriangleSets - 1);
            break;


        // view change
        case "KeyA": // translate view left, rotate left with shift
            Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, viewDelta));
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, -viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, -viewDelta));
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
                Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, -viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, -viewDelta));
            } // end if shift not pressed
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
                Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, viewDelta));
            } // end if shift not pressed
            break;
        case "KeyQ": // translate view up, rotate counterclockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, -viewDelta)));
            else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
            } // end if shift not pressed
            break;
        case "KeyE": // translate view down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, viewDelta)));
            else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, -viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
            } // end if shift not pressed
            break;
        case "Escape": // reset view to default
            Eye = vec3.copy(Eye, defaultEye);
            Center = vec3.copy(Center, defaultCenter);
            Up = vec3.copy(Up, defaultUp);
            break;

        // model transformation
        case "KeyK": // translate left, rotate left with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up, dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp, viewRight, viewDelta));
            break;
        case "Semicolon": // translate right, rotate right with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up, dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp, viewRight, -viewDelta));
            break;
        case "KeyL": // translate backward, rotate up with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight, dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp, lookAt, -viewDelta));
            break;
        case "KeyO": // translate forward, rotate down with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight, dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp, lookAt, viewDelta));
            break;
        case "KeyI": // translate up, rotate counterclockwise with shift 
            if (event.getModifierState("Shift"))
                rotateModel(lookAt, dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp, Up, viewDelta));
            break;
        case "KeyP": // translate down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                rotateModel(lookAt, dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp, Up, -viewDelta));
            break;
        case "KeyB":
            Modulation = (Modulation == 2) ? 0 : Modulation + 1;
            break;
        case "KeyN":
            handleKeyDown.modelOn.material.n = (handleKeyDown.modelOn.material.n + 1) % 20;
            console.log(handleKeyDown.modelOn.material.n);
            break;
        case "Numpad1":
            vec3.add(handleKeyDown.modelOn.material.ambient, handleKeyDown.modelOn.material.ambient, vec3.fromValues(0.1, 0.1, 0.1));
            if (handleKeyDown.modelOn.material.ambient[0] > 1.0)
                handleKeyDown.modelOn.material.ambient[0] = 0;
            if (handleKeyDown.modelOn.material.ambient[1] > 1.0)
                handleKeyDown.modelOn.material.ambient[1] = 0;
            if (handleKeyDown.modelOn.material.ambient[2] > 1.0)
                handleKeyDown.modelOn.material.ambient[2] = 0;
            console.log(handleKeyDown.modelOn.material.ambient);
            break;
        case "Numpad2":
            vec3.add(handleKeyDown.modelOn.material.diffuse, handleKeyDown.modelOn.material.diffuse, vec3.fromValues(0.1, 0.1, 0.1));
            if (handleKeyDown.modelOn.material.diffuse[0] > 1.0)
                handleKeyDown.modelOn.material.diffuse[0] = 0;
            if (handleKeyDown.modelOn.material.diffuse[1] > 1.0)
                handleKeyDown.modelOn.material.diffuse[1] = 0;
            if (handleKeyDown.modelOn.material.diffuse[2] > 1.0)
                handleKeyDown.modelOn.material.diffuse[2] = 0;
            console.log(handleKeyDown.modelOn.material.diffuse);
            break;
        case "Numpad3":
            vec3.add(handleKeyDown.modelOn.material.specular, handleKeyDown.modelOn.material.specular, vec3.fromValues(0.1, 0.1, 0.1));
            if (handleKeyDown.modelOn.material.specular[0] > 1.0)
                handleKeyDown.modelOn.material.specular[0] = 0;
            if (handleKeyDown.modelOn.material.specular[1] > 1.0)
                handleKeyDown.modelOn.material.specular[1] = 0;
            if (handleKeyDown.modelOn.material.specular[2] > 1.0)
                handleKeyDown.modelOn.material.specular[2] = 0;
            console.log(handleKeyDown.modelOn.material.specular);
            break;
        case "Backspace": // reset model transforms to default
            for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
                vec3.set(inputTriangles[whichTriSet].translation, 0, 0, 0);
                vec3.set(inputTriangles[whichTriSet].xAxis, 1, 0, 0);
                vec3.set(inputTriangles[whichTriSet].yAxis, 0, 1, 0);
            } // end for all triangle sets
            for (var whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {
                vec3.set(inputEllipsoids[whichEllipsoid].translation, 0, 0, 0);
                vec3.set(inputEllipsoids[whichTriSet].xAxis, 1, 0, 0);
                vec3.set(inputEllipsoids[whichTriSet].yAxis, 0, 1, 0);
            } // end for all ellipsoids
            break;
    } // end switch

    if (TESTING)
        window.requestAnimationFrame(renderModels); // set up frame render callback
} // end handleKeyDown

// set up the webGL environment
function setupWebGL() {

    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed
    // Get the image canvas, render an image in it
    var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
    var cw = imageCanvas.width, ch = imageCanvas.height;
    imageContext = imageCanvas.getContext("2d");
    var bkgdImage = new Image();
    bkgdImage.crossOrigin = "Anonymous";
    bkgdImage.src = "https://ncsucgclass.github.io/prog4/sky.jpg";
    bkgdImage.onload = function () {
        var iw = bkgdImage.width, ih = bkgdImage.height;
        imageContext.drawImage(bkgdImage, 0, 0, iw, ih, 0, 0, cw, ch);
    } // end onload callback

    // create a webgl canvas and set it up
    var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
    gl = webGLCanvas.getContext("webgl"); // get a webgl object from it
    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    } // end try


    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL

// read models in, load them into webgl buffers
function loadModels() {
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles"); // read in the triangle data
    var inputEllipsoids = loadEllipsoids(); // load ellipsoids

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var normToAdd; // vtx normal to add to the coord array
            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE); // other corner

            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet = 0; whichSet < numTriangleSets; whichSet++) { // for each tri set
                inputTriangles[whichSet].ellipsoid = false; // is ellipsoid?

                // load texture
                var texture = inputTriangles[whichSet].material.texture;
                inputTriangles[whichSet].texture = loadTexture(BASE_URL + texture);

                // set up hilighting, modeling translation and rotation
                inputTriangles[whichSet].center = vec3.fromValues(0, 0, 0);  // center point of tri set
                inputTriangles[whichSet].on = false; // not highlighted
                inputTriangles[whichSet].translation = vec3.fromValues(0, 0, 0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1, 0, 0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0, 1, 0); // model Y axis

                // set up the vertex and normal arrays, define model center and axes
                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
                inputTriangles[whichSet].texCoords = []; // flat texture coord list for webgl
                var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert = 0; whichSetVert < numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    texToAdd = inputTriangles[whichSet].uvs[whichSetVert]; // get tex coords to add
                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0], normToAdd[1], normToAdd[2]); // put normal in set coord list
                    inputTriangles[whichSet].texCoords.push(1 - texToAdd[0], 1 - texToAdd[1]); // put tex coords in set coord list
                    vec3.max(maxCorner, maxCorner, vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner, minCorner, vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center, inputTriangles[whichSet].center, vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center, inputTriangles[whichSet].center, 1 / numVerts); // avg ctr sum

                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                inputTriangles[whichSet].tris = inputTriangles[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].tris; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0], triToAdd[1], triToAdd[2]); // put indices in set list
                } // end for triangles in set

            } // end for each triangle set
            var temp = vec3.create();
            viewDelta = vec3.length(vec3.subtract(temp, maxCorner, minCorner)) / 100; // set global
        } // end if triangle file loaded

        // add ellipsoids to input tri sets
        if (typeof inputEllipsoids !== 'undefined')
            inputTriangles = inputTriangles.concat(inputEllipsoids);

        // sort triangle sets (models) by transparency
        inputTriangles.sort(function (a, b) {
            return b.material.alpha - a.material.alpha;
        });

        // process triangles for transparent objects
        numTriangleSets = inputTriangles.length; // remember how many tri sets + ellipsoids
        for (var whichSet = 0; whichSet < numTriangleSets; whichSet++) { // for each tri set
            // send the vertex coords and normals to webGL
            inputTriangles[whichSet].vtxBuffer = gl.createBuffer(); // init empty webgl set vertex coord buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, inputTriangles[whichSet].vtxBuffer); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glVertices), gl.STATIC_DRAW); // data in
            inputTriangles[whichSet].normBuffer = gl.createBuffer(); // init empty webgl set normal component buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, inputTriangles[whichSet].normBuffer); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glNormals), gl.STATIC_DRAW); // data in

            // send the texture coords to webGL
            inputTriangles[whichSet].texBuffer = gl.createBuffer(); // init empty webgl set texture coord buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, inputTriangles[whichSet].texBuffer); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].texCoords), gl.STATIC_DRAW); // data in

            // send the triangle indices to webGL
            inputTriangles[whichSet].triBuffer = gl.createBuffer(); // init empty triangle index buffer
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, inputTriangles[whichSet].triBuffer); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inputTriangles[whichSet].glTriangles), gl.STATIC_DRAW); // data in

            var alpha = inputTriangles[whichSet].material.alpha;
            if (alpha > TRANS_OPAQUE_BORDER) // skip if handled by z-buffer
                continue;

            numTriangles += inputTriangles[whichSet].tris;
            for (var whichSetTri = 0; whichSetTri < inputTriangles[whichSet].tris; whichSetTri++) {
                var tri = {}; // the triangle
                tri.set = inputTriangles[whichSet]; // the triangle set
                tri.offset = whichSetTri; // the tri location in the tri set
                tri.center = vec3.create();  // center of triangle
                tri.translation = inputTriangles[whichSet].translation; // the tri set translation

                var triIndices = inputTriangles[whichSet].glTriangles.slice(whichSetTri * 3, (whichSetTri * 3) + 3); // get tri indices
                var vtxToAdd; // vertex coords
                for (var whichTriVert = 0; whichTriVert < 3; whichTriVert++) {
                    vtxToAdd = inputTriangles[whichSet].glVertices.slice(triIndices[whichTriVert] * 3, (triIndices[whichTriVert] * 3) + 3); // get vertex depth to add
                    vec3.add(tri.center, tri.center, vtxToAdd); // add to ctr sum
                }
                vec3.scale(tri.center, tri.center, 1 / 3); // avg ctr sum
                strucTriangles.push(tri);
            } // end for triangles in set
        } // end for tri sets

    } // end try

    catch (e) {
        console.log(e);
    } // end catch
} // end load models

// read ellipsoids in (as triangles), load them into webgl buffers
function loadEllipsoids() {
    var inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL, "ellipsoids"); // read in the ellipsoid data

    if (inputEllipsoids != String.null) {
        // process each ellipsoid to load webgl vertex and triangle buffers
        numEllipsoids = inputEllipsoids.length; // remember how many tri sets
        for (var whichSet = 0; whichSet < numEllipsoids; whichSet++) { // for each ellipsoid tri set
            // ellipsoid description
            inputEllipsoids[whichSet].ellipsoid = true; // is ellipsoid?
            var x = inputEllipsoids[whichSet].x;
            var y = inputEllipsoids[whichSet].y;
            var z = inputEllipsoids[whichSet].z;
            var a = inputEllipsoids[whichSet].a;
            var b = inputEllipsoids[whichSet].b;
            var c = inputEllipsoids[whichSet].c;

            // load texture
            var texture = inputEllipsoids[whichSet].texture;
            inputEllipsoids[whichSet].texture = loadTexture(BASE_URL + texture);

            // set up hilighting, modeling translation and rotation
            inputEllipsoids[whichSet].center = vec3.fromValues(x, y, z);  // center point of tri set
            inputEllipsoids[whichSet].on = false; // not highlighted
            inputEllipsoids[whichSet].translation = vec3.fromValues(0, 0, 0); // no translation
            inputEllipsoids[whichSet].xAxis = vec3.fromValues(1, 0, 0); // model X axis
            inputEllipsoids[whichSet].yAxis = vec3.fromValues(0, 1, 0); // model Y axis

            // map material of the ellipsoid to "material"
            inputEllipsoids[whichSet].material = {};
            inputEllipsoids[whichSet].material.ambient = inputEllipsoids[whichSet].ambient;
            inputEllipsoids[whichSet].material.diffuse = inputEllipsoids[whichSet].diffuse;
            inputEllipsoids[whichSet].material.specular = inputEllipsoids[whichSet].specular;
            inputEllipsoids[whichSet].material.n = inputEllipsoids[whichSet].n;
            inputEllipsoids[whichSet].material.alpha = inputEllipsoids[whichSet].alpha;
            inputEllipsoids[whichSet].material.texture = texture;

            // set up the vertex and normal arrays, define model center and axes
            inputEllipsoids[whichSet].glVertices = []; // flat coord list for webgl
            inputEllipsoids[whichSet].glNormals = []; // flat normal list for webgl
            inputEllipsoids[whichSet].texCoords = []; // flat texture coord list for webgl
            inputEllipsoids[whichSet].glTriangles = []; // flat index list for webgl

            // temp information for ellipsoid rows
            var prevRowIndex = -1; // the index for the previous row
            var whichRow = []; // current row
            var whichRowIndex = 0; // the index for the current row
            var vertexCount = 0; // the total vertex count
            var triCount = 0 // the total triangle count

            // set up the vertex coord and normal arrays
            for (var theta = -Math.PI / 2; theta <= Math.PI / 2 + EPSILON; theta += Math.PI / 24) {
                var dz = c * Math.sin(theta) + z;
                for (var phi = -Math.PI; phi <= Math.PI + EPSILON; phi += Math.PI / 12) {
                    var dx = a * Math.cos(theta) * Math.cos(phi) + x;
                    var dy = b * Math.cos(theta) * Math.sin(phi) + y;
                    whichRow.push(dx, dy, dz);
                    inputEllipsoids[whichSet].glVertices.push(dx, dy, dz); // put coords in set coord list
                    inputEllipsoids[whichSet].glNormals.push(dx - x, dy - y, dz - z); // put normal in set coord list
                    inputEllipsoids[whichSet].texCoords.push(0.5 - phi / (2 * Math.PI), theta / (Math.PI) + 0.5); // put tex coords in set coord list
                    vertexCount++;
                }

                // set up the triangle array
                if (prevRowIndex >= 0) {
                    var rowVertices = 24 + 1; // the number of vertices in a row
                    var which = whichRowIndex;
                    for (var prev = prevRowIndex; prev < prevRowIndex + rowVertices; prev++) {
                        if (prev == prevRowIndex + rowVertices - 1) {
                            // inputEllipsoids[whichSet].glTriangles.push(prevRowIndex); // coming in full circle
                            inputEllipsoids[whichSet].glTriangles.push(prev, which, prevRowIndex, which, prevRowIndex, whichRowIndex);
                        } else {
                            // inputEllipsoids[whichSet].glTriangles.push(prev, which++); // put triangle indices in set list
                            inputEllipsoids[whichSet].glTriangles.push(prev, which, prev + 1, which, prev + 1, which + 1);
                        }

                        which++;
                        triCount += 2;
                    }
                }

                // update ellipsoid row information
                prevRowIndex = whichRowIndex;
                whichRow = [];
                whichRowIndex = vertexCount;
            } // end for each ellipsoid row

            inputEllipsoids[whichSet].tris = triCount; // number of triangles in this set
        } // end for each ellipsoid
    } // end if ellipsoids found

    return inputEllipsoids;
} // end load ellipsoids

// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
// SRC = https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
function loadTexture(url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const isPowerOf2 = function (value) {
        return (value & (value - 1)) == 0;
    }

    // Because images have to be download over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
        width, height, border, srcFormat, srcType,
        pixel);

    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = url;
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
            srcFormat, srcType, image);

        // WebGL1 has different requirements for power of 2 images
        // vs non power of 2 images so check if the image is a
        // power of 2 in both dimensions.
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            // Yes, it's a power of 2. Generate mips.
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            // No, it's not a power of 2. Turn of mips and set
            // wrapping to clamp to edge
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }

        if (TESTING)
            window.requestAnimationFrame(renderModels); // set up frame render callback
    };

    return texture;
}

// setup the webGL shaders
function setupShaders() {

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        attribute vec2 aTextureCoord; // texture coordinates
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader
        varying vec2 vTextureCoord; // interpolated texture coords of vertex

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 

            // texture coordinates
            vTextureCoord = aTextureCoord;
        }
    `;

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        uniform float uAlpha; // the alpha value
        uniform int Modulation;  // Modulation toggle
        uniform sampler2D uSampler; // the texture sampler

        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment
        varying vec2 vTextureCoord; // texture of fragment
            
        void main(void) {
            // texture color
            vec4 texColor = texture2D(uSampler, vTextureCoord);
            vec4 color = texColor;

            if (Modulation != 0) {
                // ambient term
                vec3 ambient = uAmbient*uLightAmbient; 
                
                // diffuse term
                vec3 normal = normalize(vVertexNormal); 
                vec3 light = normalize(uLightPosition - vWorldPos);
                float lambert = max(0.0,dot(normal,light));
                vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
                
                // specular term
                vec3 eye = normalize(uEyePosition - vWorldPos);
                vec3 halfVec = normalize(light+eye);
                float ndotLight = 2.0*dot(normal, light);
                vec3 reflectVec = normalize(ndotLight*normal - light);
                float highlight = 0.0;
                highlight = pow(max(0.0,dot(normal,halfVec)),uShininess); // Blinn_Phong
                // highlight = pow(max(0.0,dot(normal,reflectVec)),uShininess); // Phong

                vec3 specular = uSpecular*uLightSpecular*highlight; // specular term

                // combine to output color
                vec3 fragColor = ambient + diffuse + specular;
                if (Modulation == 1)
                    color = vec4(fragColor * texColor.rgb, texColor.a);
                else if (Modulation == 2)
                    color = vec4(fragColor * texColor.rgb, uAlpha * texColor.a);
            }

            gl_FragColor = color;
        }
    `;

    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                vTexAttribLoc = gl.getAttribLocation(shaderProgram, "aTextureCoord"); // ptr to texture coord attrib
                gl.enableVertexAttribArray(vTexAttribLoc); // connect attrib to array

                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat

                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess
                alphaULoc = gl.getUniformLocation(shaderProgram, "uAlpha"); // ptr to alpha
                ModulationULoc = gl.getUniformLocation(shaderProgram, "Modulation");
                samplerULoc = gl.getUniformLocation(shaderProgram, "uSampler"); // ptr to sampler

                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc, Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc, lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc, lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc, lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc, lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 

    catch (e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderModels() {

    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix, vec3.negate(negCtr, currModel.center));

        // scale for highlighting if needed
        if (currModel.on)
            mat4.multiply(mMatrix, mat4.fromScaling(temp, vec3.fromValues(1.2, 1.2, 1.2)), mMatrix); // S(1.2) * T(-ctr)

        // rotate the model to current interactive orientation
        vec3.normalize(zAxis, vec3.cross(zAxis, currModel.xAxis, currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0, 0, 1);
        mat4.multiply(mMatrix, sumRotation, mMatrix); // R(ax) * S(1.2) * T(-ctr)

        // translate back to model center
        mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.center), mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.translation), mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)

    } // end make model transform

    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices

    if (!TESTING)
        window.requestAnimationFrame(renderModels); // set up frame render callback

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix, 0.5 * Math.PI, 1, 0.1, 10); // create projection matrix
    mat4.lookAt(vMatrix, Eye, Center, Up); // create view matrix
    mat4.multiply(pvMatrix, pvMatrix, pMatrix); // projection
    mat4.multiply(pvMatrix, pvMatrix, vMatrix); // projection * view

    gl.depthMask(true); // turn on z-buffering

    // render each triangle set
    var currSet; // the tri set and its material properties
    for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet];

        if (currSet.material.alpha < TRANS_OPAQUE_BORDER) {
            gl.depthMask(false); // turn off z-buffering
            break;
        }

        // make model transform, add to view project
        makeModelTransform(currSet);
        mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent
        gl.uniform1f(alphaULoc, currSet.material.alpha); // pass in the alpha value
        gl.uniform1i(ModulationULoc, Modulation);

        // texture: feed to the fragment shader
        gl.activeTexture(gl.TEXTURE0); // tell webGL we want to affect texture unit 0
        gl.bindTexture(gl.TEXTURE_2D, currSet.texture); // bind the texture to texture unit 0
        gl.uniform1i(samplerULoc, 0); // tell the shader we bound the texture to texture unit 0

        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER, currSet.vtxBuffer); // activate
        gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, currSet.normBuffer); // activate
        gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, currSet.texBuffer); // activate
        gl.vertexAttribPointer(vTexAttribLoc, 2, gl.FLOAT, false, 0, 0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, currSet.triBuffer); // activate
        gl.drawElements(gl.TRIANGLES, 3 * currSet.tris, gl.UNSIGNED_SHORT, 0); // render
    } // end for each triangle set

    // depth sorting
    strucTriangles.forEach(e => {
        e.depth = vec3.distance(Eye, vec3.add(vec3.create(), e.center, e.translation)); // the distance from the eye
    });

    strucTriangles.sort(function (a, b) {
        return b.depth - a.depth;
    });

    // render for each transparent triangle
    for (var whichTri = 0; whichTri < numTriangles; whichTri++) {
        currSet = strucTriangles[whichTri].set;
        currTri = strucTriangles[whichTri];

        // make model transform, add to view project
        makeModelTransform(currSet);
        mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent
        gl.uniform1f(alphaULoc, currSet.material.alpha); // pass in the alpha value
        gl.uniform1i(ModulationULoc, Modulation);

        // texture: feed to the fragment shader
        gl.activeTexture(gl.TEXTURE0); // tell webGL we want to affect texture unit 0
        gl.bindTexture(gl.TEXTURE_2D, currSet.texture); // bind the texture to texture unit 0
        gl.uniform1i(samplerULoc, 0); // tell the shader we bound the texture to texture unit 0

        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER, currSet.vtxBuffer); // activate
        gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, currSet.normBuffer); // activate
        gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, currSet.texBuffer); // activate
        gl.vertexAttribPointer(vTexAttribLoc, 2, gl.FLOAT, false, 0, 0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, currSet.triBuffer); // activate
        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 6 * currTri.offset); // render

    } // end for each triangle
} // end render model

/* MAIN -- HERE is where execution begins after window load */

function main() {

    setupWebGL(); // set up the webGL environment
    loadModels(); // load in the models from tri file
    setupShaders(); // setup the webGL shaders
    renderModels(); // draw the triangles using webGL

} // end main
