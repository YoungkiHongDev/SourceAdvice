const mongoose = require('mongoose');
const express = require('express');
const app = express();
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const url = require('url');
const moment = require('moment');
const { post } = require('jquery');
const { allowedNodeEnvironmentFlags } = require('process');
mongoose.connect('mongodb://localhost:27017/hunsu');
const db = mongoose.connection;


// DB 커넥트 성공 여부
db.once('err', () => {
    console.log(err);
});

db.once('open', () => {
    console.log('DB connected');
});

// User 스키마
const UserSchema = mongoose.Schema({
    user_id: String,
    password: String,
    name: String,
    email: String,
    address: String,
});
const User = mongoose.model('users', UserSchema);

const AdviceSchema = mongoose.Schema({
    content_line    : { type : Number },
    user_id         : { type : String },
    advice          : { type : String } 
});
const Advice = mongoose.model('advice', AdviceSchema);

// Post 스키마
// 게시글을 보여줄 때 한줄씩 끊어서 보여주기 위해서 content는 배열로 지정함
const PostSchema = mongoose.Schema({
    post_no             : { type: Number },
    user_id             : { type: String },
    post_title          : { type: String },
    post_kategorie      : { type: String },
    post_content        : { type: Array },
    date                : { type: String },
    code_advice         : { type: [AdviceSchema] }
});
const Post = mongoose.model('posts', PostSchema);
//글 도큐먼트에 속성으로 하나 더 추가해서 라인수와 훈수를 저장하면 한번에 불러올 수 있다.




//이것저것 설정
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static(__dirname + '/css'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: "mongodb://localhost:27017"
})}));

//페이지 나누는 알고리즘
// 개시글 번호를 내림차순으로 정렬한 후 limit로 구분지어서 보여준다.
// 각 페이지 번호를 누르면 그 번호*10을 해서 그 수만큼 skip하고 보여준다.
// var posts = await Post.find({})
//                       .sort({post_no: -1})
//                       .skip(skip)
//                       .limit(limit)
//                       .exec();
// db.posts.insertMany([
//      {post_no : 0, user_id : "admin", post_title : "test1", post_content : "test", date : "2021-05-09 22:09:00"},
//      {post_no : 1, user_id : "admin", post_title : "test2", post_content : "test", date : "2021-05-09 22:09:00"},
//      {post_no : 2, user_id : "admin", post_title : "test3", post_content : "test", date : "2021-05-09 22:09:00"},
//      {post_no : 3, user_id : "admin", post_title : "test4", post_content : "test", date : "2021-05-09 22:09:00"},
//      {post_no : 4, user_id : "admin", post_title : "test5", post_content : "test", date : "2021-05-09 22:09:00"},
//      {post_no : 5, user_id : "admin", post_title : "test6", post_content : "test", date : "2021-05-09 22:09:00"},
//      {post_no : 6, user_id : "admin", post_title : "test7", post_content : "test", date : "2021-05-09 22:09:00"}
// ])

let page_state = 0;  //페이지 중앙에 어떤 콘텐츠를 보여줄지 결정하기 위한 변수이며 이 변수를 이용하여 중앙의 컨텐츠를 바꾼다.
var idx = 0;


// 메인 페이지
app.get('/', async (req, res) => {
    if (req.session.logined) {
        if (page_state == 2) {
            var post = await Post.find({}).exec();
            var selected_post = post[idx];
            res.render('main', {
                id : req.session.user_id,
                post : selected_post,
                page_state : page_state,
            })
        }
        else{
            var posts = await Post.find({})
                      .sort({post_no: -1})
                      .exec();
            var max_number = posts[0].post_no;
            res.render('main', {
                id: req.session.user_id,
                posts : posts,
                max_number : max_number,
                page_state : page_state,
            });
        };
    } else {
        res.render('login');
    }
});

//회원가입
app.post('/register', (req, res) => {
    var uid = req.body.user_id;
    var upwd = req.body.password;
    var uname = req.body.name;
    var uemail = req.body.email;
    var uaddress = req.body.address;

    User.findOne({ "user_id": uid }, (err, user) => {
        if (err) return res.json(err);
        if (!user) {
            User.create({ "user_id": uid, "password": upwd, "name": uname, "email": uemail, "address": uaddress }, (err) => {
                if (err) return res.json(err);
                console.log('Success');
                res.redirect('/');
            })
        } else {
            console.log('user id duplicate');
            res.send(`
                <a href="/">Back</a>
                <h1>User id duplicate</h1>
            `);
        }
    })
});

//아이디 찾기
app.post('/findIDRst', (req, res) => {
    var uname = req.body.name;
    var uemail = req.body.email;
    var uaddress = req.body.address;
    var uid;
    User.findOne({ "name": uname, "email": uemail, "address": uaddress }, (err, user) => {
        if (err) return res.json(err);
        if (user) {
            res.render('findIDResult', {
                Findid: uname
            });
        } else {
            console.log('can not find ID');
            res.send(`
                <a href="/">Back</a>
                <h1>can not find id</h1>
            `);
        }
    })
})

//비밀번호 찾기
app.post('/findPasswordRst', (req, res) => {
    var uid = req.body.user_id;
    var uname = req.body.name;
    var uemail = req.body.email;
    var uaddress = req.body.address;

    User.findOne({ "user_id": uid, "name": uname, "email": uemail, "address": uaddress }, (err, user) => {
        if (err) return res.json(err);
        if (user) {
            res.render('findPasswordResult', {
                passwordid: uname
            });
        } else {
            console.log('can not find ID');
            res.send(`
                <a href="/">Back</a>
                <h1>can not find id</h1>
            `);
        }
    })
})
// Post.find({})
    //     .sort({post_no: -1})
    //     .exec( (err, post) =>{
    //         if (err) return res.json(err);
    //         console.log(post[0].post_no);
    //     });
// db.posts.find().sort( {post_no : -1 } ).limit(1)
// db.posts.insertOne({ post_no: 1, user_id : "admin", post_title : "test1", post_kategorie : "C", post_content : "test", date : "2021-05-09 00:00:00" })
// db.posts.insertOne({ post_no: 2, user_id : "admin", post_title : "test2", post_kategorie : "Java", post_content : "test", date : "2021-05-09 00:00:00" })
// db.posts.insertOne({ post_no: 3, user_id : "admin", post_title : "test3", post_kategorie : "Python", post_content : "test", date : "2021-05-09 00:00:00" })
// db.posts.insertOne({ post_no: 4, user_id : "admin", post_title : "test4", post_kategorie : "C", post_content : "test", date : "2021-05-09 00:00:00" })
// db.posts.insertOne({ post_no: 5, user_id : "admin", post_title : "test5", post_kategorie : "C", post_content : "test", date : "2021-05-09 00:00:00" })

//게시글 작성
app.post('/uploadPost', (req, res) => {
    let post_no;
    var user_id = req.session.user_id;
    var post_title = req.body.post_title;
    var post_kategorie = req.body.post_kategorie;
    var post_content = req.body.post_content;
    var content = post_content.split(/\r\n|\r\n/);
    var date = moment().format("YYYY-MM-DD HH:mm:ss");
    
    Post.findOne({})
        .sort({post_no: -1})
        .exec( (err, post) =>{
            if (err) return res.json(err);   
            post_no = post.post_no;
            Post.create({ "post_no": post_no+1, "user_id": user_id, "post_title": post_title, "post_kategorie": post_kategorie,
                        "post_content": content, "date": date }, (err) => {
                if (err) return res.json(err);
                console.log('Success');
                page_state = 0;
                res.redirect('/');
            });   
    });
});

//로고 클릭시 메인 화면
app.get('/BackHome', (req, res) => {
    page_state = 0;
    res.redirect('/');
})

//로그아웃 버튼 클릭
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

//회원가입 버튼 클릭
app.post('/regist', (req, res) => {
    res.render('register', );
})

//아이디 찾기 버튼 클릭
app.post('/findID', (req, res) => {
    res.render('findID');
})

//비밀번호 찾기 버튼 클릭
app.post('/findpwd', (req, res) => {
    res.render('findPassword');
})

//뒤로가기 버튼 클릭
app.post('/BackHome', (req, res) => {
    page_state = 0;
    res.redirect('/');
})

//게시글 작성 버튼 클릭
app.post('/writePost_btn', (req, res) => {
    page_state = 1;
    res.redirect('/');
})

//게시글을 보기위해 제목을 클릭했을 때
app.get('/read/:post_no',(req,res,next) => {
    page_state = 2;
    idx = req.params.post_no;
    res.redirect('/');
});

//로그인 버튼 클릭
app.post('/', (req, res) => {
    let id = req.body.user_id;
    let pwd = req.body.password;
    duplicate(req, res, id, pwd);
});


app.listen(3000, () => {
    console.log('listening 3000port');
});

//로그인 시 동작될 함수
function duplicate(req, res, uid, upwd) {
    let parseUrl = url.parse(req.url);
    let resource = parseUrl.pathname;
    User.findOne({ "user_id": uid }, (err, user) => {
        if (err) return res.json(err);

        if (!user) {
            console.log('Cannot find user');
            res.send(`
                    <a href="/">Back</a>
                    <h1>rechecking your ID -Can't find user</h1>
                `);
        } else {
            User.findOne({ "password": upwd })
                .exec((err, user) => {
                    if (err) return res.json(err);

                    if (!user) {
                        console.log('login failed');
                        res.send('<a href="/">Back</a><h1>Login failed - different password</h1>');
                    } else {
                        console.log('welcome');
                        req.session.user_id = uid;
                        req.session.logined = true;
                        res.redirect('/');
                    }
                })
        }
    });
}

//C 메뉴 클릭 시
app.get('/board_c', (req, res) => {
    page_state = 3;
    res.redirect('/');
});

//Java 메뉴 클릭 시
app.get('/board_java', (req, res) => {
    page_state = 4;
    res.redirect('/');
});

//Python 메뉴 클릭 시
app.get('/board_python', (req, res) => {
    page_state = 5;
    res.redirect('/');
});

// 훈수 추가
app.post('/write_advice', async (req, res) => {
    var input_user_id = req.session.user_id;
    var input_advice = req.body.advice;
    var input_line = req.body.line * 1;
    var search_number = req.body.post_no;

    Post.findOne({ post_no : search_number })
        .exec( (err, post) =>{
            if (err) return res.json(err);

            post.code_advice.push(new Advice({
                content_line : input_line,
                user_id : input_user_id,
                advice : input_advice
            }))
            post.save(function(err){
                if(!err)
                    console.log('advice saved!')
            })
            console.log('Success');
            res.redirect('/');
    });
});

// 훈수 보기